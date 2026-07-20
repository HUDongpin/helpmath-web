import {
  Blocks,
  BookOpenCheck,
  Brain,
  ChartNoAxesCombined,
  Languages,
  Lightbulb,
  MessageSquareText,
  MousePointerClick,
  Route,
  Shapes,
  UsersRound,
  Volume2
} from 'lucide-react';

import type {FeatureCard} from '@/content/types';

const icons = [
  Languages,
  Shapes,
  MousePointerClick,
  MessageSquareText,
  Brain,
  Route,
  UsersRound,
  BookOpenCheck,
  Blocks,
  Volume2,
  Lightbulb,
  ChartNoAxesCombined
];

export function FeatureGrid({
  cards,
  numbered = false,
  columns = 3
}: {
  cards: FeatureCard[];
  numbered?: boolean;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className={`feature-grid feature-grid--${columns}`}>
      {cards.map((card, index) => {
        const Icon = icons[index % icons.length];
        return (
          <article className="feature-card" key={card.id}>
            <div aria-hidden="true" className="feature-card__icon">
              {numbered ? <span>{index + 1}</span> : <Icon size={25} strokeWidth={2.2} />}
            </div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            {card.detail ? <p className="feature-card__detail">{card.detail}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
