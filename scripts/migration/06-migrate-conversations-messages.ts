// Straight copy — ids, profile references, and timestamps all carry over
// unchanged (profile ids were preserved 1:1 in 04-migrate-profiles.ts).
// Conversations must land before messages (messages.conversation_id FKs to
// it), and the update_conversation_last_message trigger on messages would
// otherwise overwrite conversations.last_message_* with whatever the last
// *inserted* row happens to be — inserting messages in created_at order
// makes that land on the actually-latest message, matching the monolith's
// own last_message_* values rather than fighting the trigger.
import { rencontre } from "./lib/clients.js";
import { readOutput } from "./lib/io.js";

type MonolithConversation = {
  id: string;
  profile1_id: string;
  profile2_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message_content: string | null;
  last_message_sender_profile_id: string | null;
};

type MonolithMessage = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

async function main() {
  const { conversations, messages } = readOutput<{
    conversations: MonolithConversation[];
    messages: MonolithMessage[];
  }>("export");

  const { data: insertedConvos, error: convoError } = await rencontre
    .from("conversations")
    .insert(
      conversations.map((c) => ({
        id: c.id,
        profile1_id: c.profile1_id,
        profile2_id: c.profile2_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
        last_message_at: c.last_message_at,
        last_message_content: c.last_message_content,
        last_message_sender_profile_id: c.last_message_sender_profile_id,
      }))
    )
    .select("id");
  if (convoError) throw convoError;
  console.log(`inserted ${insertedConvos.length} conversations`);

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let insertedMessages = 0;
  for (const m of sortedMessages) {
    const { error } = await rencontre.from("messages").insert({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_profile_id: m.sender_profile_id,
      recipient_profile_id: m.recipient_profile_id,
      content: m.content,
      is_read: m.is_read,
      created_at: m.created_at,
      updated_at: m.updated_at,
    });
    if (error) throw error;
    insertedMessages++;
  }
  console.log(`inserted ${insertedMessages} messages`);

  // The trigger stamps last_message_at = now() implicitly via updated_at on
  // conversations, but last_message_at/content/sender were set explicitly
  // per-message during the loop above already via the trigger itself using
  // each message's own created_at — restore the original values in case
  // insertion order or trigger timing drifted from the monolith's record.
  for (const c of conversations) {
    const { error } = await rencontre
      .from("conversations")
      .update({
        last_message_at: c.last_message_at,
        last_message_content: c.last_message_content,
        last_message_sender_profile_id: c.last_message_sender_profile_id,
      })
      .eq("id", c.id);
    if (error) throw error;
  }
  console.log("reconciled conversations.last_message_* with monolith values");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
