const LINEAR_API = "https://api.linear.app/graphql";

interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

interface IssueCreateResult {
  issueCreate: {
    success: boolean;
    issue: { id: string; identifier: string; url: string } | null;
  };
}

export async function createLinearIssue(
  apiKey: string,
  input: { teamId: string; title: string; description: string }
): Promise<{ id: string; identifier: string; url: string } | null> {
  const response = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: `mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }`,
      variables: {
        input: {
          teamId: input.teamId,
          title: input.title,
          description: input.description,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear API HTTP ${response.status}`);
  }

  const json = (await response.json()) as GraphqlResponse<IssueCreateResult>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const created = json.data?.issueCreate;
  if (!created?.success || !created.issue) {
    return null;
  }

  return created.issue;
}

export async function validateLinearApiKey(apiKey: string): Promise<boolean> {
  const response = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: `query { viewer { id } }`,
    }),
  });

  if (!response.ok) return false;

  const json = (await response.json()) as GraphqlResponse<{ viewer: { id: string } }>;
  return Boolean(json.data?.viewer?.id) && !json.errors?.length;
}
