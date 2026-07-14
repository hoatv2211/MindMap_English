import { useEffect, useId, useRef, useState } from "react";
import type { DictionaryLookup } from "../../shared/contracts";
import { api } from "../api/client";

interface DictionaryInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  onUnknownChange?: (unconfirmed: boolean) => void;
}

export function DictionaryInput({ value, onChange, ariaLabel, onUnknownChange }: DictionaryInputProps) {
  const listId = useId();
  const [items, setItems] = useState<string[]>([]);
  const [lookup, setLookup] = useState<DictionaryLookup | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [confirmedUnknown, setConfirmedUnknown] = useState("");
  const unknownChangeRef = useRef(onUnknownChange);
  unknownChangeRef.current = onUnknownChange;

  useEffect(() => {
    const term = value.trim();
    if (!term) { setItems([]); setLookup(null); setConfirmedUnknown(""); unknownChangeRef.current?.(false); return; }
    setConfirmedUnknown("");
    const timeout = window.setTimeout(() => {
      void Promise.all([api.dictionaryComplete(term), api.dictionaryLookup(term)])
        .then(([completion, result]) => {
          setItems(completion.items.slice(0, 6));
          setLookup(result);
          unknownChangeRef.current?.(!result.known);
          setActiveIndex(-1);
        })
        .catch(() => { setItems([]); setLookup(null); });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [value]);

  const select = (term: string) => { onChange(term); setOpen(false); };

  return <div className="dictionary-input">
    <input
      aria-label={ariaLabel}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open && items.length > 0}
      aria-controls={listId}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      value={value}
      onFocus={() => setOpen(true)}
      onChange={(event) => { onChange(event.target.value); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" && items.length) {
          event.preventDefault();
          setOpen(true);
          setActiveIndex((index) => Math.min(index + 1, items.length - 1));
        } else if (event.key === "ArrowUp" && items.length) {
          event.preventDefault();
          setActiveIndex((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter" && activeIndex >= 0) {
          event.preventDefault();
          select(items[activeIndex]);
        } else if (event.key === "Escape") setOpen(false);
      }}
    />
    {open && items.length > 0 && <ul id={listId} role="listbox">
      {items.map((item, index) => <li id={`${listId}-${index}`} key={item} role="option" aria-selected={index === activeIndex} onMouseDown={(event) => { event.preventDefault(); select(item); }}>{item}</li>)}
    </ul>}
    {lookup && !lookup.known && <div className="dictionary-status">
      <span>Cần kiểm tra</span>
      {lookup.suggestions.map((suggestion) => <button key={suggestion} type="button" aria-label={`Dùng từ ${suggestion}`} onClick={() => select(suggestion)}>{suggestion}</button>)}
      <button type="button" aria-label={`Giữ từ ${lookup.term}`} aria-pressed={confirmedUnknown === lookup.normalizedTerm} onClick={() => { setConfirmedUnknown(lookup.normalizedTerm); unknownChangeRef.current?.(false); }}>Giữ từ này</button>
    </div>}
    {lookup?.existingVocabularyId && <small className="dictionary-known">Đã có trong thư viện</small>}
  </div>;
}
