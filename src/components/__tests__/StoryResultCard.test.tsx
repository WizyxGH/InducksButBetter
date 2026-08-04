import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));

import { StoryResultCard } from '../StoryResultCard';

const row = {
  storycode: 'W WDC  81-02',
  story_title: 'The Lost Mine',
  firstpublicationdate: '1947-06-01',
  // "role:personcode|fullname" pairs, semicolon separated.
  creators: 'w:CB|Carl Barks;a:Stefano Zanchi|Stefano Zanchi',
  character_list: 'DD|Donald Duck|||',
};

const renderCard = (props: Record<string, unknown> = {}) =>
  render(
    <TooltipProvider>
      <StoryResultCard row={row} {...props} />
    </TooltipProvider>
  );

describe('StoryResultCard creator links', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('links a writer to the author page, not the character page', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /carl barks/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/authors/CB')
    );
  });

  it('links an artist to the author page', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /stefano zanchi/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/authors/Stefano+Zanchi')
    );
  });

  it('links a character to the character page', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /donald duck/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/characters/DD')
    );
  });

  it('never routes a creator through the character handler', () => {
    // The card used to hand `onSelectCharacter` to creator badges, so clicking
    // an author opened the character page even though the href said /authors/.
    const onSelectCharacter = vi.fn();
    renderCard({ onSelectCharacter });

    fireEvent.click(screen.getByRole('link', { name: /carl barks/i }));

    expect(onSelectCharacter).not.toHaveBeenCalled();
  });

  it('still routes a character through the character handler', () => {
    const onSelectCharacter = vi.fn();
    renderCard({ onSelectCharacter });

    fireEvent.click(screen.getByRole('link', { name: /donald duck/i }));

    expect(onSelectCharacter).toHaveBeenCalledWith('DD', 'Donald Duck');
  });
});

describe('StoryResultCard credit parsing', () => {
  // Regression: the SQL used GROUP_CONCAT(DISTINCT ...), whose separator is
  // always ',', so the whole credit list arrived as one entry. The writer was
  // rendered as "Roberto Moscato,w" and the artist disappeared entirely.
  const credited = {
    ...row,
    storycode: 'I TL 3273-6',
    creators:
      'p:Roberto Moscato|Roberto Moscato;w:Roberto Moscato|Roberto Moscato;a:Stefano Zanchi|Stefano Zanchi;i:Stefano Zanchi|Stefano Zanchi',
  };

  const renderCredited = () =>
    render(
      <TooltipProvider>
        <StoryResultCard row={credited} />
      </TooltipProvider>
    );

  it('lists the writer without leaking the next credit into the name', () => {
    renderCredited();
    expect(screen.getByRole('link', { name: 'Roberto Moscato' })).toBeInTheDocument();
    expect(screen.queryByText(/Roberto Moscato,/)).not.toBeInTheDocument();
  });

  it('lists the artist that used to go missing', () => {
    renderCredited();
    expect(screen.getByRole('link', { name: 'Stefano Zanchi' })).toBeInTheDocument();
  });

  it('shows a person credited under two roles only once per role', () => {
    renderCredited();
    // "p" and "w" are the same person, "a" and "i" too: one badge each.
    expect(screen.getAllByRole('link', { name: 'Roberto Moscato' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Stefano Zanchi' })).toHaveLength(1);
  });

  it('renders script and art credits at the same type size', () => {
    // The art line used to render its badges one step smaller than the script
    // line, so the same kind of information appeared in two sizes.
    renderCredited();
    const script = screen.getByRole('link', { name: 'Roberto Moscato' }).querySelector('span');
    const art = screen.getByRole('link', { name: 'Stefano Zanchi' }).querySelector('span');

    expect(script?.className).toBe(art?.className);
  });

  it('splits publications on the semicolon so titles may contain commas', () => {
    render(
      <TooltipProvider>
        <StoryResultCard
          row={{
            ...row,
            publication_list: 'it|Alla riscossa, contro il terremoto!|1;fr|Le Journal de Mickey|3',
          }}
        />
      </TooltipProvider>
    );

    expect(screen.getByText(/Alla riscossa, contro il terremoto!/)).toBeInTheDocument();
    expect(screen.getByText(/Le Journal de Mickey/)).toBeInTheDocument();
  });
});

describe('StoryResultCard story selection', () => {
  it('opens the story on a plain click on the card body', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith('W WDC  81-02');
  });

  it('does not open the story when a nested link was clicked', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    fireEvent.click(screen.getByRole('link', { name: /carl barks/i }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves a ctrl-click to the browser instead of selecting in place', () => {
    const onSelect = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderCard({ onSelect });

    fireEvent.click(screen.getByRole('button'), { ctrlKey: true });

    expect(onSelect).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/stories/'), '_blank', 'noopener');
    open.mockRestore();
  });
});
