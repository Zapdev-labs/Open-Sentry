import { z } from "zod";

export const linearIntegrationConfigSchema = z.object({
  apiKey: z.string().min(1),
  teamId: z.string().min(1),
});

export type LinearIntegrationConfig = z.infer<typeof linearIntegrationConfigSchema>;

export type LinearIntegrationConfigPublic = {
  teamId: string;
  hasApiKey: boolean;
};
