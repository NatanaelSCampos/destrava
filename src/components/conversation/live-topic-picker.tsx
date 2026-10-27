"use client";

import { useId, useRef, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers3,
  Search,
  X,
} from "lucide-react";
import type { LiveTopic } from "@/domain/conversation/live-client";
import {
  groupLiveTopics,
  LIVE_MAX_TOPICS,
  toggleLiveTopics,
  topicSelectionState,
} from "@/domain/conversation/live-topic-selection";

function SelectionBox({
  label,
  checked,
  partial = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  partial?: boolean;
  onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = partial;
  }, [partial]);
  return (
    <label className="live-topic-check">
      <input ref={input} type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span>{label}</span>
    </label>
  );
}

export function LiveTopicPicker({
  topics,
  selectedIds,
  onChange,
  onContinue,
}: {
  topics: LiveTopic[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onContinue: () => void;
}) {
  const [query, setQuery] = useState(""),
    [unitFilter, setUnitFilter] = useState("");
  const [expanded, setExpanded] = useState<string[]>(topics[0] ? [topics[0].unitId] : []);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const searchId = useId(),
    filterId = useId(),
    resultId = useId();
  const allUnits = groupLiveTopics(topics),
    groups = groupLiveTopics(topics, query, unitFilter);
  const selected = topics.filter((topic) => selectedIds.includes(topic.id));
  const count = selected.length;
  function toggle(ids: string[]) {
    const next = toggleLiveTopics(selectedIds, ids);
    if (!next) {
      setError(
        "Escolha até " +
          LIVE_MAX_TOPICS +
          " etapas por conversa. Você pode dividir a prática em mais encontros.",
      );
      return;
    }
    setError("");
    onChange(next);
  }
  return (
    <div className="live-topic-picker">
      <div className="live-voice-topic-filters">
        <label htmlFor={searchId}>
          <span>Buscar etapa ou assunto</span>
          <div className="live-voice-search">
            <Search size={17} aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              placeholder="Ex.: encontros, pedidos…"
              onChange={(event) => {
                setQuery(event.target.value);
                setLimits({});
              }}
              aria-controls={resultId}
            />
          </div>
        </label>
        <label htmlFor={filterId}>
          <span>Unidade</span>
          <select
            id={filterId}
            value={unitFilter}
            onChange={(event) => {
              setUnitFilter(event.target.value);
              setLimits({});
              if (event.target.value)
                setExpanded((previous) => [...new Set([...previous, event.target.value])]);
            }}
            aria-controls={resultId}
          >
            <option value="">Todas as unidades</option>
            {allUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                Unidade {unit.number} · {unit.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="live-topic-selection-bar">
        <div>
          <span className="live-topic-selection-icon">
            <Layers3 size={20} aria-hidden="true" />
          </span>
          <div>
            <strong role="status" aria-live="polite">
              {count
                ? count + (count === 1 ? " etapa selecionada" : " etapas selecionadas")
                : "Monte sua conversa"}
            </strong>
            <small>
              {count
                ? "Você pode combinar etapas de várias unidades."
                : "Marque uma ou mais etapas, ou escolha uma unidade."}
            </small>
          </div>
        </div>
        {count > 0 && (
          <div className="live-topic-selection-actions">
            <button
              type="button"
              className="live-topic-clear"
              onClick={() => {
                setError("");
                onChange([]);
              }}
            >
              Limpar seleção
            </button>
            <button type="button" className="live-voice-primary" onClick={onContinue}>
              Ajustar conversa <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="live-voice-error">
          {error}
        </p>
      )}
      {(query || unitFilter) && (
        <div className="live-voice-topic-results">
          <p>
            {groups.reduce((sum, unit) => sum + unit.matches.length, 0)} etapas encontradas · sua
            seleção foi mantida
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setUnitFilter("");
              setLimits({});
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
      <div id={resultId} className="live-topic-units">
        {groups.map((unit) => {
          const ids = unit.topics.map((topic) => topic.id),
            state = topicSelectionState(selectedIds, ids);
          const open = Boolean(query.trim()) || expanded.includes(unit.id);
          const limit = limits[unit.id] ?? 6;
          return (
            <section
              className={"live-topic-unit " + (state.count ? "has-selection" : "")}
              key={unit.id}
              aria-label={"Unidade " + unit.number + " · " + unit.title}
            >
              <div className="live-topic-unit-heading">
                <span className="live-topic-unit-icon">
                  <BookOpen size={22} aria-hidden="true" />
                </span>
                <div>
                  <span className="live-voice-kicker">UNIDADE {unit.number}</span>
                  <h3>{unit.title}</h3>
                  <p>
                    {unit.topics.length} etapas disponíveis{" "}
                    <span>· {state.count} selecionadas</span>
                  </p>
                </div>
              </div>
              <div className="live-topic-unit-actions">
                <SelectionBox
                  label={"Selecionar unidade " + unit.number + " inteira"}
                  checked={state.all}
                  partial={state.partial}
                  onChange={() => toggle(ids)}
                />
                <button
                  type="button"
                  className="live-topic-expand"
                  aria-expanded={open}
                  aria-controls={resultId + "-" + unit.id}
                  onClick={() => {
                    setQuery("");
                    setExpanded((previous) =>
                      open ? previous.filter((id) => id !== unit.id) : [...previous, unit.id],
                    );
                  }}
                >
                  {open ? "Recolher etapas" : "Ver etapas"}
                  <ChevronDown size={17} aria-hidden="true" />
                </button>
              </div>
              <p className="live-topic-unit-note">
                Inclui somente as etapas disponíveis do que você já estudou.
              </p>
              {open && (
                <div id={resultId + "-" + unit.id} className="live-topic-unit-body">
                  <div className="live-voice-topic-grid">
                    {unit.matches.slice(0, limit).map((item) => {
                      const checked = selectedIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={
                            "live-voice-topic live-topic-stage " + (checked ? "is-selected" : "")
                          }
                        >
                          <span className="live-voice-topic-top">
                            <span>ETAPA {item.lessonOrder ?? unit.topics.indexOf(item) + 1}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle([item.id])}
                              aria-label={"Incluir etapa: " + item.title}
                            />
                          </span>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                          <span className="live-voice-topic-foot">
                            <CheckCircle2 size={14} aria-hidden="true" />
                            {item.studiedActivities}{" "}
                            {item.studiedActivities === 1
                              ? "atividade estudada"
                              : "atividades estudadas"}
                            <span>
                              {checked ? <Check size={16} aria-label="Selecionada" /> : "+"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {unit.matches.length > limit && (
                    <button
                      type="button"
                      className="live-voice-secondary live-voice-topic-more"
                      onClick={() =>
                        setLimits((previous) => ({ ...previous, [unit.id]: limit + 6 }))
                      }
                    >
                      Ver mais {Math.min(6, unit.matches.length - limit)} etapas{" "}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {!groups.length && (
          <div className="live-voice-empty">
            <Search size={24} aria-hidden="true" />
            <h3>Nenhuma etapa encontrada</h3>
            <p>Tente outra palavra ou retire o filtro. Sua seleção continua guardada.</p>
            <button
              type="button"
              className="live-voice-secondary"
              onClick={() => {
                setQuery("");
                setUnitFilter("");
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
      {count > 0 && (
        <div className="live-topic-selection-review">
          <h3>Na sua conversa</h3>
          <div>
            {selected.map((topic) => (
              <button
                type="button"
                key={topic.id}
                onClick={() => toggle([topic.id])}
                aria-label={"Remover etapa: " + topic.title}
              >
                <span>
                  <small>Unidade {topic.unitNumber}</small>
                  {topic.title}
                </span>
                <X size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
