import type {TextSection as TextSectionContent} from '@/content/types';

import {Eyebrow} from './ui';

export function TextSection({content}: {content: TextSectionContent}) {
  return (
    <section className="text-section" id={content.id}>
      <div className="text-section__heading">
        {content.eyebrow ? <Eyebrow>{content.eyebrow}</Eyebrow> : null}
        <h2>{content.title}</h2>
      </div>
      <div className="text-section__body">
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {content.bullets?.length ? (
          <ul>
            {content.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
