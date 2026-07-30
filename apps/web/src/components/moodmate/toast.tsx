type MoodmateToastProps = {
  action?: {
    label: string;
    onClick: () => void;
  };
  message: string;
};

export function MoodmateToast({ action, message }: MoodmateToastProps) {
  return (
    <div aria-live="polite" className="moodmate-toast" role="status">
      <span className="moodmate-toast__message">{message}</span>
      {action ? (
        <button
          className="moodmate-toast__action"
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
