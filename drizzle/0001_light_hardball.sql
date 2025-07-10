ALTER TABLE "projectgpt_chat_message" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projectgpt_chat_message" ADD COLUMN "guestSessionId" varchar(255);--> statement-breakpoint
CREATE INDEX "chat_message_guest_session_id_idx" ON "projectgpt_chat_message" USING btree ("guestSessionId");