import { toast } from "sonner";
import { hapticSuccess, hapticError, hapticLight } from "./native";

/** Small, consistent in-app notifications (bottom of the screen, above the nav). */
export const notify = {
  success: (message: string, description?: string) => { hapticSuccess(); toast.success(message, { description }); },
  error: (message: string, description?: string) => { hapticError(); toast.error(message, { description, duration: 5000 }); },
  info: (message: string, description?: string) => { hapticLight(); toast(message, { description }); },
};
