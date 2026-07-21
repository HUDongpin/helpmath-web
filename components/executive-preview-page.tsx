import {ArrowRight, KeyRound, LockKeyhole, ShieldAlert} from 'lucide-react';

import type {Locale} from '@/content/types';
import {Link} from '@/i18n/navigation';

import {Container, Eyebrow, Section} from './ui';

type ExecutivePreviewState = 'authenticated' | 'login' | 'unavailable';

type ExecutivePreviewPageProps = {
  error?: boolean;
  expiresAt?: number;
  locale: Locale;
  returnTo: string;
  state: ExecutivePreviewState;
};

const copy = {
  en: {
    eyebrow: 'Internal executive review',
    title: 'HELP Math JavaScript demo preview',
    intro:
      'A restricted review space for two early JavaScript reconstructions of legacy HELP Math animations.',
    restrictedTitle: 'Private review — not for distribution',
    restrictedBody:
      'These prototypes are not validated as faithful or complete. Audio, technical acceptance, visual validation, and rights review remain pending. Do not forward, record, republish, or present them as finished HELP Math products.',
    loginTitle: 'Enter the executive preview',
    loginShortcut: 'Enter private preview',
    loginBody:
      'Use the high-entropy review passphrase supplied through the approved private channel. Access is temporary and expires automatically.',
    expiryLabel: 'Review window closes:',
    expiryNote: 'Active sessions cannot continue beyond this time.',
    passphraseLabel: 'Executive preview passphrase',
    submit: 'Open private preview',
    error:
      'Access could not be verified. Check the passphrase or contact the review operator through the approved private channel.',
    unavailableTitle: 'Executive preview is unavailable',
    unavailableBody:
      'Access is closed because the private preview is not configured or its review window has expired. No demo content has been released publicly.',
    demosTitle: 'Private JavaScript prototypes',
    demosBody:
      'Open either prototype below while this short-lived review session is active.',
    firstTitle: 'Conversion 1.2',
    firstBody: 'Internal JavaScript animation prototype for executive review.',
    secondTitle: 'Conversion 1.4',
    secondBody: 'Internal JavaScript animation prototype for executive review.',
    openDemo: 'Open prototype',
    logout: 'End private session',
  },
  es: {
    eyebrow: 'Revisión ejecutiva interna',
    title: 'Vista previa de demos JavaScript de HELP Math',
    intro:
      'Un espacio restringido para revisar dos reconstrucciones iniciales en JavaScript de animaciones heredadas de HELP Math.',
    restrictedTitle: 'Revisión privada — no distribuir',
    restrictedBody:
      'Estos prototipos no están validados como fieles ni completos. El audio, la aceptación técnica, la validación visual y la revisión de derechos siguen pendientes. No los reenvíes, grabes, publiques ni presentes como productos terminados de HELP Math.',
    loginTitle: 'Entrar a la vista previa ejecutiva',
    loginShortcut: 'Entrar a la vista previa privada',
    loginBody:
      'Usa la frase de acceso de alta entropía enviada por el canal privado aprobado. El acceso es temporal y vence automáticamente.',
    expiryLabel: 'La ventana de revisión cierra:',
    expiryNote: 'Las sesiones activas no pueden continuar después de esta hora.',
    passphraseLabel: 'Frase de acceso para la vista previa ejecutiva',
    submit: 'Abrir vista previa privada',
    error:
      'No se pudo verificar el acceso. Revisa la frase de acceso o contacta al responsable de la revisión por el canal privado aprobado.',
    unavailableTitle: 'La vista previa ejecutiva no está disponible',
    unavailableBody:
      'El acceso está cerrado porque la vista previa privada no está configurada o su periodo de revisión ha vencido. Ninguna demo se ha publicado.',
    demosTitle: 'Prototipos JavaScript privados',
    demosBody:
      'Abre cualquiera de los prototipos mientras esta sesión de revisión de corta duración esté activa.',
    firstTitle: 'Conversión 1.2',
    firstBody: 'Prototipo interno de animación JavaScript para revisión ejecutiva.',
    secondTitle: 'Conversión 1.4',
    secondBody: 'Prototipo interno de animación JavaScript para revisión ejecutiva.',
    openDemo: 'Abrir prototipo',
    logout: 'Cerrar sesión privada',
  },
} as const;

export function ExecutivePreviewPage({
  error = false,
  expiresAt,
  locale,
  returnTo,
  state,
}: ExecutivePreviewPageProps) {
  const text = copy[locale];

  return (
    <main id="main-content">
      <header className="border-b-2 border-[var(--ink)] bg-[var(--blue-pale)] py-14 md:py-20">
        <Container className="max-w-5xl">
          <Eyebrow>{text.eyebrow}</Eyebrow>
          <div className="flex max-w-3xl items-start gap-4">
            <LockKeyhole aria-hidden="true" className="mt-2 shrink-0 text-[var(--blue)]" size={34} />
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight font-bold tracking-tight md:text-6xl">
                {text.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-[var(--ink-soft)] md:text-xl">
                {text.intro}
              </p>
              {state === 'login' ? (
                <a className="action action--primary mt-6 w-fit" href="#executive-preview-login">
                  <span>{text.loginShortcut}</span>
                  <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
                </a>
              ) : null}
            </div>
          </div>
        </Container>
      </header>

      <Section className="section--compact">
        <Container className="max-w-5xl">
          <aside
            className="flex items-start gap-4 border-2 border-[var(--ink)] bg-[var(--yellow-pale)] p-5 shadow-[6px_6px_0_var(--ink)] md:p-7"
            role="note"
          >
            <ShieldAlert aria-hidden="true" className="mt-1 shrink-0 text-[#8a5a00]" size={30} />
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
                {text.restrictedTitle}
              </h2>
              <p className="mt-2 text-[var(--ink-soft)]">{text.restrictedBody}</p>
            </div>
          </aside>
        </Container>
      </Section>

      {state === 'authenticated' ? (
        <AuthenticatedPreview expiresAt={expiresAt} locale={locale} text={text} />
      ) : state === 'login' ? (
        <LoginPanel
          error={error}
          expiresAt={expiresAt}
          locale={locale}
          returnTo={returnTo}
          text={text}
        />
      ) : (
        <UnavailablePanel text={text} />
      )}
    </main>
  );
}

function LoginPanel({
  error,
  expiresAt,
  locale,
  returnTo,
  text,
}: {
  error: boolean;
  expiresAt?: number;
  locale: Locale;
  returnTo: string;
  text: (typeof copy)[Locale];
}) {
  return (
    <Section className="pt-0">
      <Container className="max-w-3xl">
        <div className="contact-form-shell scroll-mt-24" id="executive-preview-login">
          <div className="flex items-start gap-4">
            <KeyRound aria-hidden="true" className="mt-1 shrink-0 text-[var(--blue)]" size={30} />
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
                {text.loginTitle}
              </h2>
              <p className="mt-2 text-[var(--ink-soft)]" id="executive-preview-login-help">
                {text.loginBody}
              </p>
              <ExpiryNotice expiresAt={expiresAt} locale={locale} text={text} />
            </div>
          </div>

          {error ? (
            <p
              className="mt-6 border-2 border-[#b42318] bg-[var(--coral-pale)] p-4 font-bold text-[#7a271a]"
              id="executive-preview-login-error"
              role="alert"
            >
              {text.error}
            </p>
          ) : null}

          <form action="/api/executive-preview/session" className="mt-7 grid gap-5" method="post">
            <input name="locale" type="hidden" value={locale} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <label className="block font-bold" htmlFor="executive-preview-passphrase">
              {text.passphraseLabel}
              <input
                aria-describedby={error
                  ? 'executive-preview-login-help executive-preview-login-error'
                  : 'executive-preview-login-help'}
                aria-invalid={error}
                autoCapitalize="none"
                autoComplete="off"
                autoFocus={error}
                className="mt-2 min-h-12 w-full rounded-lg border-2 border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
                id="executive-preview-passphrase"
                name="passphrase"
                required
                spellCheck={false}
                type="password"
              />
            </label>
            <button className="action action--primary justify-self-start" type="submit">
              {text.submit}
            </button>
          </form>
        </div>
      </Container>
    </Section>
  );
}

function AuthenticatedPreview({
  expiresAt,
  locale,
  text,
}: {
  expiresAt?: number;
  locale: Locale;
  text: (typeof copy)[Locale];
}) {
  const demos = [
    {href: '/demos/conversion-1-2', title: text.firstTitle, body: text.firstBody},
    {href: '/demos/conversion-1-4', title: text.secondTitle, body: text.secondBody},
  ];

  return (
    <Section className="pt-0">
      <Container className="max-w-5xl">
        <div className="mb-7 max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
            {text.demosTitle}
          </h2>
          <p className="mt-2 text-[var(--ink-soft)]">{text.demosBody}</p>
          <ExpiryNotice expiresAt={expiresAt} locale={locale} text={text} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {demos.map((demo) => (
            <article
              className="flex flex-col border-2 border-[var(--ink)] bg-white p-6 shadow-[5px_5px_0_var(--ink)]"
              key={demo.href}
            >
              <Eyebrow>{demo.href}</Eyebrow>
              <h3 className="font-[family-name:var(--font-display)] text-3xl font-bold">
                {demo.title}
              </h3>
              <p className="mt-2 grow text-[var(--ink-soft)]">{demo.body}</p>
              <Link
                aria-label={`${text.openDemo}: ${demo.title}`}
                className="action action--secondary mt-6 self-start"
                href={demo.href}
                locale={locale}
              >
                <span>{text.openDemo}</span>
                <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
              </Link>
            </article>
          ))}
        </div>
        <form action="/api/executive-preview/session" className="mt-9" method="post">
          <input name="action" type="hidden" value="logout" />
          <input name="locale" type="hidden" value={locale} />
          <button className="action action--quiet" type="submit">
            {text.logout}
          </button>
        </form>
      </Container>
    </Section>
  );
}

function ExpiryNotice({
  expiresAt,
  locale,
  text,
}: {
  expiresAt?: number;
  locale: Locale;
  text: (typeof copy)[Locale];
}) {
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt);
  const dateTime = expiry.toISOString();
  const formatted = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'long',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric',
  }).format(expiry);

  return (
    <p className="mt-3 text-sm font-semibold text-[var(--ink-soft)]">
      {text.expiryLabel}{' '}
      <time dateTime={dateTime}>{formatted}</time>. {text.expiryNote}
    </p>
  );
}

function UnavailablePanel({text}: {text: (typeof copy)[Locale]}) {
  return (
    <Section className="pt-0">
      <Container className="max-w-3xl">
        <div className="border-2 border-[var(--ink)] bg-white p-6 shadow-[6px_6px_0_var(--ink)] md:p-8" role="status">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
            {text.unavailableTitle}
          </h2>
          <p className="mt-3 text-[var(--ink-soft)]">{text.unavailableBody}</p>
        </div>
      </Container>
    </Section>
  );
}
