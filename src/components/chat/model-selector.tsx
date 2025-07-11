"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Zap, Crown, Brain } from "lucide-react";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  tier: "free" | "premium";
  description: string;
  strengths: string[];
  icon: React.ReactNode;
}

const models: AIModel[] = [
  {
    id: "sarvamai/sarvam-m:free",
    name: "Sarvam M",
    provider: "Sarvam AI",
    tier: "free",
    description: "Advanced multilingual AI model",
    strengths: ["Multilingual", "General", "Reasoning"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    name: "Dolphin Mistral 24B Venice",
    provider: "Cognitive Computations",
    tier: "free",
    description: "Large parameter model for complex tasks",
    strengths: ["Reasoning", "Code", "Analysis"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "google/gemma-3n-e2b-it:free",
    name: "Gemma 3N E2B IT",
    provider: "Google",
    tier: "free",
    description: "Google's efficient instruction-tuned model",
    strengths: ["Instructions", "Efficiency", "General"],
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "tencent/hunyuan-a13b-instruct:free",
    name: "Hunyuan A13B Instruct",
    provider: "Tencent",
    tier: "free",
    description: "Instruction-following model with strong capabilities",
    strengths: ["Instructions", "Reasoning", "General"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "tngtech/deepseek-r1t2-chimera:free",
    name: "DeepSeek R1T2 Chimera",
    provider: "TNG Technology",
    tier: "free",
    description: "Hybrid model with advanced reasoning",
    strengths: ["Reasoning", "Code", "Logic"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "openrouter/cypher-alpha:free",
    name: "Cypher Alpha",
    provider: "OpenRouter",
    tier: "free",
    description: "Specialized model for complex problem solving",
    strengths: ["Problem Solving", "Analysis", "Logic"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "deepseek/deepseek-r1-0528:free",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    tier: "free",
    description: "Advanced reasoning model",
    strengths: ["Reasoning", "Code", "Math"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "mistralai/devstral-small-2505:free",
    name: "Devstral Small",
    provider: "Mistral AI",
    tier: "free",
    description: "Optimized for development tasks",
    strengths: ["Code", "Development", "Speed"],
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "OpenAI",
    tier: "premium",
    description: "Most capable model for complex reasoning",
    strengths: ["Reasoning", "Code", "Analysis"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "OpenAI",
    tier: "free",
    description: "Fast and efficient for most tasks",
    strengths: ["Speed", "General", "Coding"],
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "claude-3-sonnet",
    name: "Claude 3 Sonnet",
    provider: "Anthropic",
    tier: "premium",
    description: "Excellent for writing and analysis",
    strengths: ["Writing", "Analysis", "Safety"],
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    tier: "free",
    description: "Fast and lightweight",
    strengths: ["Speed", "Efficiency", "Concise"],
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "llama-2-70b",
    name: "Llama 2 70B",
    provider: "Meta",
    tier: "free",
    description: "Open source powerhouse",
    strengths: ["Open Source", "Code", "Logic"],
    icon: <Brain className="h-4 w-4" />,
  },
];

export function ModelSelector({
  selectedModel,
  onModelChange,
}: ModelSelectorProps) {
  const currentModel = models.find((m) => m.id === selectedModel) ?? models[0];

  if (!currentModel) {
    throw new Error("No models available");
  }
  const [credits] = useState(3);

  const handleModelSelect = (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (model?.tier === "premium" && credits === 0) {
      // Show ad or upgrade prompt
      return;
    }
    onModelChange(modelId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {currentModel.icon}
          <span className="hidden sm:inline">{currentModel.name}</span>
          <span className="sm:hidden">{currentModel.provider}</span>
          {currentModel.tier === "premium" && (
            <Crown className="h-3 w-3 text-yellow-500" />
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Select AI Model</span>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-yellow-500" />
            <span className="text-xs">{credits} credits</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            className="flex flex-col items-start gap-2 p-3 cursor-pointer"
            onClick={() => handleModelSelect(model.id)}
            disabled={model.tier === "premium" && credits === 0}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                {model.icon}
                <span className="font-medium">{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.provider}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {model.tier === "premium" ? (
                  <Crown className="h-3 w-3 text-yellow-500" />
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Free
                  </Badge>
                )}
                {model.id === selectedModel && (
                  <Badge variant="default" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground w-full">
              {model.description}
            </p>

            <div className="flex flex-wrap gap-1">
              {model.strengths.map((strength) => (
                <Badge key={strength} variant="outline" className="text-xs">
                  {strength}
                </Badge>
              ))}
            </div>

            {model.tier === "premium" && credits === 0 && (
              <p className="text-xs text-yellow-400">
                Watch an ad to unlock this model
              </p>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
