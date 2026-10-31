import { TextResponsePrompt } from "@/components/study/prompts/text-response-prompt";

export function ShortAnswerPrompt(props) {
  return <TextResponsePrompt {...props} multiline />;
}
