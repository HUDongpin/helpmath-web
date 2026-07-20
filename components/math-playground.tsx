import {BookOpenText, MessageCircleMore, MousePointer2} from 'lucide-react';

export function MathPlayground({locale}: {locale: 'en' | 'es'}) {
  const copy =
    locale === 'es'
      ? {
          prompt: 'Construye ¾',
          language: 'tres cuartos',
          success: '¡Lo lograste!',
          hint: 'Arrastra una pieza'
        }
      : {
          prompt: 'Build ¾',
          language: 'three fourths',
          success: 'You got it!',
          hint: 'Drag a piece'
        };

  return (
    <div aria-label={copy.prompt} className="math-playground" role="img">
      <div className="math-playground__topbar">
        <span className="math-playground__dots" />
        <span>{copy.prompt}</span>
        <BookOpenText aria-hidden="true" size={18} />
      </div>
      <div className="math-playground__canvas">
        <div className="fraction-model">
          <span className="fraction-model__part fraction-model__part--filled" />
          <span className="fraction-model__part fraction-model__part--filled" />
          <span className="fraction-model__part fraction-model__part--filled" />
          <span className="fraction-model__part" />
        </div>
        <div className="math-playground__equation">
          <span>3</span>
          <i />
          <span>4</span>
        </div>
        <div className="math-playground__language">
          <MessageCircleMore aria-hidden="true" size={19} />
          <span>{copy.language}</span>
        </div>
        <div className="math-playground__success">{copy.success}</div>
        <div className="math-playground__hint">
          <MousePointer2 aria-hidden="true" size={17} />
          {copy.hint}
        </div>
      </div>
      <div aria-hidden="true" className="math-playground__shape math-playground__shape--one" />
      <div aria-hidden="true" className="math-playground__shape math-playground__shape--two" />
    </div>
  );
}
