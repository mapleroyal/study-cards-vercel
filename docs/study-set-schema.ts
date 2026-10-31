export type StudySet = {
  title: string;
  category: string; // slash-separated path, e.g. "First Quarter/Classes/Science"
  cards: Card[];
};

export type Card =
  | {
      id: number;
      type: "true_false";
      question: string;
      answer: boolean;
      explanation: string;
    }
  | {
      id: number;
      type: "multiple_choice";
      question: string;
      options: Record<string, string>;
      answer: string;
      explanation: string;
    }
  | {
      id: number;
      type: "multiple_response";
      question: string;
      options: Record<string, string>;
      answer: string[];
      explanation: string;
    }
  | {
      id: number;
      type: "fill_in_the_blank";
      question: string;
      answer: string[];
      explanation: string;
    }
  | {
      id: number;
      type: "ordering";
      question: string;
      unordered_items: string[];
      answer: string[];
      explanation: string;
    }
  | {
      id: number;
      type: "matching";
      question: string;
      prompts: string[];
      choices: string[];
      answer: {
        prompt: string;
        choices: string[]; // multiple choices may match one prompt
      }[];
      explanation: string;
    }
  | {
      id: number;
      type: "short_answer";
      question: string;
      answer: string;
      explanation: string;
    };
