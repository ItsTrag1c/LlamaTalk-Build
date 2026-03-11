import { useState } from "react";
import { engineCall } from "../lib/engine";

interface OnboardingPageProps {
  config: Record<string, any>;
  onComplete: () => void;
}

export function OnboardingPage({ config, onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    stack: "",
    explanations: "",
    projects: "",
    other: "",
  });
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [saving, setSaving] = useState(false);

  const steps = [
    {
      title: "What's your go-to programming language or stack?",
      field: "stack" as const,
      placeholder: "e.g., TypeScript + React, Python, Rust...",
    },
    {
      title: "How do you prefer explanations?",
      field: "explanations" as const,
      placeholder: "Brief and to the point, or detailed with context?",
    },
    {
      title: "What kind of projects do you usually work on?",
      field: "projects" as const,
      placeholder: "Web apps, CLI tools, games, data pipelines...",
    },
    {
      title: "Anything else you'd like me to know?",
      field: "other" as const,
      placeholder: "Work habits, preferences... (optional)",
    },
  ];

  const currentStep = steps[step];
  const isLastQuestion = step === steps.length - 1;
  const showTelegram = step === steps.length; // after all questions

  const handleNext = () => {
    if (isLastQuestion) {
      setStep(steps.length); // go to telegram step
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const lessons: string[] = [];
      if (answers.stack.trim()) lessons.push(`Preferred language/stack: ${answers.stack.trim()}`);
      if (answers.explanations.trim()) lessons.push(`Explanation preference: ${answers.explanations.trim()}`);
      if (answers.projects.trim()) lessons.push(`Typical projects: ${answers.projects.trim()}`);
      if (answers.other.trim()) lessons.push(`Additional: ${answers.other.trim()}`);

      if (lessons.length > 0) {
        await engineCall("saveOnboarding", { lessons });
      }

      if (telegramEnabled && telegramToken.trim()) {
        await engineCall("saveSetting", { key: "telegramBotToken", value: telegramToken.trim() });
        // Auto-generate access code for bot authentication
        const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map((b) => b.toString(16).padStart(2, "0")).join("");
        await engineCall("saveSetting", { key: "telegramAccessCode", value: code });
      }

      await engineCall("saveSetting", { key: "onboardingComplete", value: true });
    } catch { /* */ }
    setSaving(false);
    onComplete();
  };

  const handleSkip = async () => {
    try {
      await engineCall("saveSetting", { key: "onboardingComplete", value: true });
    } catch { /* */ }
    onComplete();
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--bg)] p-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-[var(--accent)]">
            {showTelegram ? "Connect Telegram" : "Get to know you"}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            {showTelegram
              ? "Chat with the agent from your phone (optional)"
              : `Question ${step + 1} of ${steps.length}`}
          </p>
        </div>

        {/* Safety notice — only on first step */}
        {step === 0 && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--warning)]/8 border border-[var(--warning)]/15 text-sm text-[var(--text-muted)]">
            Clank Build can read, write, and delete files, and execute commands.
            Review agent actions carefully, especially at low safety level.
          </div>
        )}

        {/* Question steps */}
        {!showTelegram && currentStep && (
          <div>
            <label className="text-base font-medium text-[var(--text)] block mb-3">
              {currentStep.title}
            </label>
            <input
              type="text"
              autoFocus
              value={answers[currentStep.field]}
              onChange={(e) => setAnswers({ ...answers, [currentStep.field]: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
              placeholder={currentStep.placeholder}
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
        )}

        {/* Telegram step */}
        {showTelegram && (
          <div className="space-y-5">
            <div
              className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] cursor-pointer"
              onClick={() => setTelegramEnabled(!telegramEnabled)}
            >
              <div>
                <div className="text-sm font-medium text-[var(--text)]">Enable Telegram Bot</div>
                <div className="text-xs text-[var(--text-dim)] mt-0.5">Messages route through Telegram's servers</div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${telegramEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${telegramEnabled ? "left-6" : "left-1"}`} />
              </div>
            </div>

            {telegramEnabled && (
              <div className="space-y-3 pl-1">
                <p className="text-xs text-[var(--text-dim)]">
                  Get a token from <b>@BotFather</b> on Telegram. An access code will be generated automatically — send it to the bot to authenticate.
                </p>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="Bot token from @BotFather"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="text-xs text-[var(--text-dim)]">
                  Start the bot with <code className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">clankbuild --telegram</code>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-[var(--accent)]" : i < step ? "bg-[var(--accent)]/40" : "bg-[var(--border)]"
              }`}
            />
          ))}
          <div className={`w-2 h-2 rounded-full transition-colors ${showTelegram ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleSkip}
            className="text-sm text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
          >
            Skip setup
          </button>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="px-5 py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
              >
                Back
              </button>
            )}
            {showTelegram ? (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Get Started"}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
              >
                {isLastQuestion ? "Next" : "Continue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
