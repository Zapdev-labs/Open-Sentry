import { createHmac } from "node:crypto";
import type { AlertChannel, AlertChannelConfig } from "@sentry-clone/db";

export type DeliveryResult =
  | { ok: true; responseCode: number; responseBody: string }
  | { ok: false; responseCode: number; responseBody: string; errorMessage: string };

export interface AlertPayload {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  value: number;
  threshold: number;
  windowMinutes: number;
  environment: string | null;
  organizationId: string;
  triggeredAt: string;
  message: string;
}

const SLACK_COLOR = {
  triggered: "#dc2626",
  resolved: "#16a34a",
};

function buildSlackBlocks(payload: AlertPayload) {
  return {
    text: `[Sentry Clone] ${payload.ruleName}`,
    attachments: [
      {
        color: SLACK_COLOR.triggered,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: payload.ruleName },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Value:*\n${payload.value}` },
              { type: "mrkdwn", text: `*Threshold:*\n${payload.threshold}` },
              {
                type: "mrkdwn",
                text: `*Window:*\n${payload.windowMinutes} min`,
              },
              {
                type: "mrkdwn",
                text: `*Environment:*\n${payload.environment ?? "all"}`,
              },
            ],
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: payload.message },
          },
        ],
      },
    ],
  };
}

function buildDiscordPayload(payload: AlertPayload) {
  return {
    embeds: [
      {
        title: payload.ruleName,
        color: 0xdc2626,
        fields: [
          { name: "Value", value: String(payload.value), inline: true },
          { name: "Threshold", value: String(payload.threshold), inline: true },
          { name: "Window", value: `${payload.windowMinutes} min`, inline: true },
          { name: "Environment", value: payload.environment ?? "all", inline: true },
        ],
        description: payload.message,
        timestamp: payload.triggeredAt,
      },
    ],
  };
}

function buildTeamsPayload(payload: AlertPayload) {
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: "DC2626",
    summary: payload.ruleName,
    title: payload.ruleName,
    sections: [
      {
        facts: [
          { name: "Value", value: String(payload.value) },
          { name: "Threshold", value: String(payload.threshold) },
          { name: "Window", value: `${payload.windowMinutes} min` },
          { name: "Environment", value: payload.environment ?? "all" },
        ],
        text: payload.message,
      },
    ],
  };
}

function buildPagerDutyPayload(payload: AlertPayload, integrationKey: string) {
  return {
    routing_key: integrationKey,
    event_action: "trigger",
    dedup_key: payload.ruleId,
    payload: {
      summary: `${payload.ruleName}: ${payload.message}`,
      source: "sentry-clone",
      severity: "error",
      component: "alerting",
      custom_details: {
        value: payload.value,
        threshold: payload.threshold,
        windowMinutes: payload.windowMinutes,
        environment: payload.environment,
      },
    },
  };
}

function signWebhookBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function postJson(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<DeliveryResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        responseCode: res.status,
        responseBody: text.slice(0, 4000),
        errorMessage: `HTTP ${res.status}`,
      };
    }
    return { ok: true, responseCode: res.status, responseBody: text.slice(0, 4000) };
  } catch (err) {
    return {
      ok: false,
      responseCode: 0,
      responseBody: "",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function sendEmail(
  recipients: string[],
  subject: string,
  text: string
): Promise<DeliveryResult> {
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    return {
      ok: false,
      responseCode: 0,
      responseBody: "",
      errorMessage: "SMTP_URL not configured",
    };
  }

  // Minimal SMTP send via Bun's built-in fetch against a transactional relay.
  // Production deploys should swap this for nodemailer or a transactional API.
  const from = process.env.SMTP_FROM ?? "alerts@sentry-clone.local";
  const relayUrl = process.env.SMTP_RELAY_URL ?? smtpUrl;
  const res = await fetch(relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: recipients, subject, text }),
  });
  const textBody = await res.text().catch(() => "");
  if (!res.ok) {
    return {
      ok: false,
      responseCode: res.status,
      responseBody: textBody.slice(0, 4000),
      errorMessage: `HTTP ${res.status}`,
    };
  }
  return { ok: true, responseCode: res.status, responseBody: textBody.slice(0, 4000) };
}

export async function deliverToChannel(
  channel: AlertChannel,
  payload: AlertPayload
): Promise<DeliveryResult> {
  const config = channel.config as AlertChannelConfig;
  const subject = `[Sentry Clone] ${payload.ruleName}`;
  const text = [
    `Rule: ${payload.ruleName}`,
    `Value: ${payload.value} (threshold ${payload.threshold})`,
    `Window: ${payload.windowMinutes} minutes`,
    `Environment: ${payload.environment ?? "all"}`,
    "",
    payload.message,
  ].join("\n");

  switch (config.kind) {
    case "slack": {
      return postJson(config.webhookUrl, buildSlackBlocks(payload));
    }
    case "discord": {
      return postJson(config.webhookUrl, buildDiscordPayload(payload));
    }
    case "msteams": {
      return postJson(config.webhookUrl, buildTeamsPayload(payload));
    }
    case "webhook": {
      const body = JSON.stringify({ ...payload, subject, text });
      const headers: Record<string, string> = {};
      if (config.secret) {
        const signature = signWebhookBody(config.secret, body);
        headers["X-Sentry-Clone-Signature"] = `sha256=${signature}`;
      }
      return postJson(config.url, JSON.parse(body), headers);
    }
    case "pagerduty": {
      return postJson(
        "https://events.pagerduty.com/v2/enqueue",
        buildPagerDutyPayload(payload, config.integrationKey)
      );
    }
    case "email": {
      return sendEmail(config.recipients, subject, text);
    }
  }
}
