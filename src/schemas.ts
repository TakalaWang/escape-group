import { z } from "zod";

const LOCATIONS = [
  "keelung",
  "taipei",
  "new_taipei",
  "taoyuan",
  "hsinchu",
  "miaoli",
  "taichung",
  "changhua",
  "nantou",
  "yunlin",
  "chiayi",
  "tainan",
  "kaohsiung",
  "pingtung",
  "yilan",
  "hualien",
  "taitung",
  "penghu",
  "kinmen",
  "matsu",
] as const;

export const CreateGroupSchema = z.object({
  roomName: z.string().trim().min(1, "密室名稱不能為空").max(100),
  studio: z.string().trim().max(100).optional().nullable(),
  location: z.enum(LOCATIONS).optional().nullable(),
  datetime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  duration: z.number().int().positive().max(1440),
  minMembers: z.number().int().positive().max(50).optional().nullable(),
  maxMembers: z.number().int().min(2, "人數上限至少為 2").max(50),
  prefilledMembers: z.number().int().nonnegative().default(1),
  price: z.number().int().nonnegative().max(100000).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  displayName: z.string().optional(),
});

export const UpdateGroupSchema = CreateGroupSchema.partial();

export const SubscriptionSchema = z.object({
  type: z.enum(["location", "keyword", "price", "weekday"]),
  value: z.string().min(1).max(200),
  displayName: z.string().optional(),
});

export const KickMemberSchema = z.object({
  memberId: z.string().uuid(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
