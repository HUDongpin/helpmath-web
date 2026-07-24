import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  ArrowLeft as LucideArrowLeft,
  BookOpenText as LucideBookOpenText,
  Handshake as LucideHandshake,
  Languages as LucideLanguages,
  LifeBuoy as LucideLifeBuoy,
  Menu as LucideMenu,
  MessageCircleMore as LucideMessageCircleMore,
  RotateCw as LucideRotateCw,
  Shapes as LucideShapes,
  ShieldCheck as LucideShieldCheck,
  X as LucideX,
} from 'lucide-react';
import {createElement, type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {
  ArrowLeft,
  BookOpenText,
  Handshake,
  Languages,
  LifeBuoy,
  Menu,
  MessageCircleMore,
  RotateCw,
  Shapes,
  ShieldCheck,
  X,
} from '../components/server-icons';

type IconProps = {
  'aria-hidden': true;
  size: number;
  strokeWidth: number;
};

const icons = [
  ['ArrowLeft', LucideArrowLeft, ArrowLeft],
  ['BookOpenText', LucideBookOpenText, BookOpenText],
  ['Handshake', LucideHandshake, Handshake],
  ['Languages', LucideLanguages, Languages],
  ['LifeBuoy', LucideLifeBuoy, LifeBuoy],
  ['Menu', LucideMenu, Menu],
  ['MessageCircleMore', LucideMessageCircleMore, MessageCircleMore],
  ['RotateCw', LucideRotateCw, RotateCw],
  ['Shapes', LucideShapes, Shapes],
  ['ShieldCheck', LucideShieldCheck, ShieldCheck],
  ['X', LucideX, X],
] as const;

function canonicalSvg(component: ComponentType<IconProps>) {
  const markup = renderToStaticMarkup(createElement(component, {
    'aria-hidden': true,
    size: 18,
    strokeWidth: 2.4,
  }));
  const openingTag = markup.match(/^<svg ([^>]*)>/u);
  assert.ok(openingTag, 'Expected a single SVG root');

  const attributes = Object.fromEntries(
    [...openingTag[1].matchAll(/([^\s=]+)="([^"]*)"/gu)]
      .map(([, name, value]) => [name, value])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return {attributes, children: markup.slice(openingTag[0].length)};
}

describe('static SVG icons', () => {
  it('preserves the reviewed Lucide geometry and presentation contract', () => {
    for (const [name, lucideIcon, staticIcon] of icons) {
      assert.deepEqual(
        canonicalSvg(staticIcon as ComponentType<IconProps>),
        canonicalSvg(lucideIcon as ComponentType<IconProps>),
        name,
      );
    }
  });
});
