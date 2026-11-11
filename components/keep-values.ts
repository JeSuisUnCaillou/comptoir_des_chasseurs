import { startTransition, type FormEvent } from "react";

/**
 * Submits a form to a server action without React's automatic reset, so a
 * refused submission keeps what was typed. Forms that should clear on success
 * change their `key` instead.
 */
export function keepValues(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}
