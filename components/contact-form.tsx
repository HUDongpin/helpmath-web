'use client';

import {Turnstile} from '@marsidev/react-turnstile';
import type {TurnstileInstance} from '@marsidev/react-turnstile';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {ContactContent, Locale} from '@/content/types';
import {CONTACT_LIMITS, normalizeContactTopic, type ContactField} from '@/lib/contact-schema';

const DEVELOPMENT_TURNSTILE_TOKEN = 'development-bypass';

type FieldErrors = Partial<Record<ContactField, string>>;
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

interface ContactFormProps {
  content: ContactContent;
  locale: Locale;
}

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function clientErrors(formData: FormData, content: ContactContent): FieldErrors {
  const errors: FieldErrors = {};
  const requiredFields = ['role', 'name', 'email', 'topic', 'message'] as const;

  for (const field of requiredFields) {
    if (!text(formData, field)) errors[field] = content.form.validation.required;
  }

  const email = text(formData, 'email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = content.form.validation.invalidEmail;
  }

  const message = text(formData, 'message');
  if (message && message.length < 20) errors.message = content.form.validation.required;
  if (message.length > CONTACT_LIMITS.message) {
    errors.message = content.form.validation.messageTooLong;
  }

  if (formData.get('privacyConsent') !== 'true') {
    errors.privacyConsent = content.form.validation.consentRequired;
  }

  return errors;
}

function FieldError({id, message}: {id: string; message?: string}) {
  if (!message) return null;
  return (
    <span className="mt-1 block text-sm font-bold text-[#b42318]" id={id}>
      {message}
    </span>
  );
}

function RequiredMark({label}: {label: string}) {
  return (
    <>
      <span aria-hidden="true" className="ml-1 text-[#b42318]">*</span>
      <span className="sr-only"> ({label})</span>
    </>
  );
}

export function ContactForm({content, locale}: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const publicSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const localSimulation = process.env.NODE_ENV !== 'production' && !publicSiteKey;
  const [turnstileToken, setTurnstileToken] = useState(
    localSimulation ? DEVELOPMENT_TURNSTILE_TOKEN : '',
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<SubmissionState>('idle');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [messageLength, setMessageLength] = useState(0);

  useEffect(() => {
    const candidate = normalizeContactTopic(
      new URLSearchParams(window.location.search).get('topic') ?? '',
    );
    if (
      candidate &&
      content.form.topicOptions.some((option) => option.value === candidate)
    ) {
      // The URL is an external navigation source; synchronize it after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTopic(candidate);
    }
  }, [content.form.topicOptions]);

  function focusFirstError() {
    requestAnimationFrame(() => {
      const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      invalid?.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'submitting') return;

    const formData = new FormData(event.currentTarget);
    const nextErrors = clientErrors(formData, content);
    if (!turnstileToken) nextErrors.turnstileToken = content.form.errorMessage;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setState('error');
      focusFirstError();
      return;
    }

    setState('submitting');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          locale,
          role: text(formData, 'role'),
          name: text(formData, 'name'),
          email: text(formData, 'email'),
          organization: text(formData, 'organization'),
          topic: text(formData, 'topic'),
          message: text(formData, 'message'),
          privacyConsent: formData.get('privacyConsent') === 'true',
          turnstileToken,
          website: text(formData, 'website'),
        }),
      });
      const result = (await response.json().catch(() => null)) as {ok?: boolean} | null;

      if (!response.ok || result?.ok !== true) throw new Error('submission-failed');
      setState('success');
      setErrors({});
    } catch {
      setState('error');
      if (publicSiteKey) {
        setTurnstileToken('');
        turnstileRef.current?.reset();
      }
    }

    requestAnimationFrame(() => statusRef.current?.focus());
  }

  if (state === 'success') {
    return (
      <div
        className="border-2 border-[var(--ink)] bg-[var(--mint-pale)] p-6 shadow-[6px_6px_0_var(--ink)]"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          {content.form.successTitle}
        </h2>
        <p className="mt-3 text-[var(--ink-soft)]">{content.form.successMessage}</p>
      </div>
    );
  }

  const fieldClass =
    'mt-2 min-h-12 w-full rounded-lg border-2 border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none aria-[invalid=true]:border-[#b42318]';
  return (
    <form
      aria-busy={state === 'submitting'}
      className="grid gap-6"
      noValidate
      onSubmit={submit}
      ref={formRef}
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          {content.form.title}
        </h2>
        <p className="mt-2 text-[var(--ink-soft)]">{content.form.intro}</p>
      </div>

      {state === 'error' && (
        <div
          className="border-2 border-[#b42318] bg-[var(--coral-pale)] p-4"
          ref={statusRef}
          role="alert"
          tabIndex={-1}
        >
          <strong className="block">{content.form.errorTitle}</strong>
          <span>{content.form.errorMessage}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block font-bold">
          {content.form.fields.role}
          <RequiredMark label={content.form.validation.required} />
          <select
            aria-describedby={errors.role ? 'contact-role-error' : undefined}
            aria-invalid={Boolean(errors.role)}
            className={fieldClass}
            defaultValue=""
            name="role"
            required
          >
            <option disabled value="">—</option>
            {content.form.roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <FieldError id="contact-role-error" message={errors.role} />
        </label>

        <label className="block font-bold">
          {content.form.fields.topic}
          <RequiredMark label={content.form.validation.required} />
          <select
            aria-describedby={errors.topic ? 'contact-topic-error' : undefined}
            aria-invalid={Boolean(errors.topic)}
            className={fieldClass}
            name="topic"
            onChange={(event) => setSelectedTopic(event.target.value)}
            required
            value={selectedTopic}
          >
            <option disabled value="">—</option>
            {content.form.topicOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <FieldError id="contact-topic-error" message={errors.topic} />
        </label>

        <label className="block font-bold">
          {content.form.fields.name}
          <RequiredMark label={content.form.validation.required} />
          <input
            aria-describedby={errors.name ? 'contact-name-error' : undefined}
            aria-invalid={Boolean(errors.name)}
            autoComplete="name"
            className={fieldClass}
            maxLength={CONTACT_LIMITS.name}
            name="name"
            placeholder={content.form.placeholders.name}
            required
            type="text"
          />
          <FieldError id="contact-name-error" message={errors.name} />
        </label>

        <label className="block font-bold">
          {content.form.fields.email}
          <RequiredMark label={content.form.validation.required} />
          <input
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className={fieldClass}
            inputMode="email"
            maxLength={CONTACT_LIMITS.email}
            name="email"
            placeholder={content.form.placeholders.email}
            required
            type="email"
          />
          <FieldError id="contact-email-error" message={errors.email} />
        </label>
      </div>

      <label className="block font-bold">
        {content.form.fields.organization}
        <input
          aria-describedby={errors.organization ? 'contact-organization-error' : undefined}
          aria-invalid={Boolean(errors.organization)}
          autoComplete="organization"
          className={fieldClass}
          maxLength={CONTACT_LIMITS.organization}
          name="organization"
          placeholder={content.form.placeholders.organization}
          type="text"
        />
        <FieldError id="contact-organization-error" message={errors.organization} />
      </label>

      <label className="block font-bold">
        {content.form.fields.message}
        <RequiredMark label={content.form.validation.required} />
        <textarea
          aria-describedby={`contact-message-count${errors.message ? ' contact-message-error' : ''}`}
          aria-invalid={Boolean(errors.message)}
          className={`${fieldClass} min-h-44 resize-y`}
          maxLength={CONTACT_LIMITS.message}
          name="message"
          onChange={(event) => setMessageLength(event.target.value.length)}
          placeholder={content.form.placeholders.message}
          required
        />
        <span className="mt-1 block text-right text-sm text-[var(--ink-soft)]" id="contact-message-count">
          {messageLength.toLocaleString(locale)} / {CONTACT_LIMITS.message.toLocaleString(locale)}
        </span>
        <FieldError id="contact-message-error" message={errors.message} />
      </label>

      <label className="flex items-start gap-3 font-bold">
        <input
          aria-describedby={errors.privacyConsent ? 'contact-consent-error' : undefined}
          aria-invalid={Boolean(errors.privacyConsent)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--blue)]"
          name="privacyConsent"
          required
          type="checkbox"
          value="true"
        />
        <span>
          {content.form.fields.privacyConsent}
          <RequiredMark label={content.form.validation.required} />
          <FieldError id="contact-consent-error" message={errors.privacyConsent} />
        </span>
      </label>

      <div aria-describedby={errors.turnstileToken ? 'contact-turnstile-error' : undefined}>
        {publicSiteKey ? (
          <Turnstile
            onError={() => {
              setTurnstileToken('');
              setErrors((current) => ({
                ...current,
                turnstileToken: content.form.errorMessage,
              }));
              setState('error');
            }}
            onExpire={() => setTurnstileToken('')}
            onSuccess={setTurnstileToken}
            options={{
              action: 'contact',
              language: locale,
              responseField: false,
              size: 'flexible',
            }}
            ref={turnstileRef}
            siteKey={publicSiteKey}
          />
        ) : localSimulation ? (
          <p className="text-sm text-[var(--ink-soft)]" role="status">
            {locale === 'es'
              ? 'La protección contra spam está en modo de simulación local.'
              : 'Spam protection is running in local simulation mode.'}
          </p>
        ) : (
          <p className="font-bold text-[#b42318]" role="alert">
            {content.form.errorMessage}
          </p>
        )}
        <FieldError id="contact-turnstile-error" message={errors.turnstileToken} />
      </div>

      <label hidden>
        Website
        <input autoComplete="off" name="website" tabIndex={-1} type="text" />
      </label>

      <button
        className="action action--primary justify-self-start disabled:cursor-not-allowed disabled:opacity-60"
        disabled={state === 'submitting' || !turnstileToken}
        type="submit"
      >
        {state === 'submitting' ? content.form.submittingLabel : content.form.submitLabel}
      </button>
    </form>
  );
}
