import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/http.js';
import { HubLayout } from '../components/hubs/HubLayout.jsx';
import { QuestionEditor, makeBlankQuestion } from '../components/quiz/QuestionEditor.jsx';
import { Button } from '../components/shared/Button.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

const DRAFT_KEY = 'askly.quizDraft';

export function QuizBuilder() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([makeBlankQuestion()]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const firstLoad = useRef(true);

  // Load existing quiz, or restore a new-quiz draft.
  useEffect(() => {
    if (editing) {
      api
        .getQuiz(id)
        .then(({ quiz }) => {
          setTitle(quiz.title);
          setDescription(quiz.description || '');
          setQuestions(quiz.questions.length ? quiz.questions : [makeBlankQuestion()]);
        })
        .catch((err) => toast(err.message || 'Could not load quiz', { variant: 'error' }))
        .finally(() => setLoading(false));
    } else {
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (draft) {
          setTitle(draft.title || '');
          setDescription(draft.description || '');
          if (draft.questions?.length) setQuestions(draft.questions);
        }
      } catch {
        /* ignore */
      }
    }
  }, [editing, id, toast]);

  // Autosave the draft for new quizzes.
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setDirty(true);
    if (!editing) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, questions }));
      } catch {
        /* ignore */
      }
    }
  }, [title, description, questions, editing]);

  const setQuestion = (i, q) => setQuestions((qs) => qs.map((x, idx) => (idx === i ? q : x)));
  const addQuestion = () => setQuestions((qs) => [...qs, makeBlankQuestion()]);
  const removeQuestion = (i) =>
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));
  const duplicateQuestion = (i) =>
    setQuestions((qs) => {
      const copy = { ...qs[i], id: crypto.randomUUID() };
      return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
    });
  const moveQuestion = (from, to) =>
    setQuestions((qs) => {
      if (to < 0 || to >= qs.length) return qs;
      const next = qs.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });

  const validate = () => {
    if (!title.trim()) return 'Add a quiz title.';
    for (const [i, q] of questions.entries()) {
      if (!q.text.trim()) return `Question ${i + 1} needs text.`;
      const filled = q.options.filter((o) => o.text.trim());
      if (filled.length < 2) return `Question ${i + 1} needs at least two options.`;
      if (!q.options.some((o) => o.id === q.correctOptionId && o.text.trim()))
        return `Question ${i + 1} needs a correct answer selected.`;
    }
    return null;
  };

  const save = async () => {
    const error = validate();
    if (error) return toast(error, { variant: 'error' });
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        options: q.options.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim() })),
        correctOptionId: q.correctOptionId,
        timeLimitSec: q.timeLimitSec,
      })),
    };
    try {
      if (editing) await api.updateQuiz(id, payload);
      else {
        await api.createQuiz(payload);
        localStorage.removeItem(DRAFT_KEY);
      }
      toast('Quiz saved', { variant: 'success' });
      navigate('/quiz');
    } catch (err) {
      toast(err.message || 'Could not save quiz', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <HubLayout title="Loading quiz…">
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      </HubLayout>
    );
  }

  return (
    <HubLayout
      title={editing ? 'Edit quiz' : 'New quiz'}
      subtitle={
        !editing && dirty ? 'Draft saved automatically' : 'Build your questions and answers'
      }
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/quiz')}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save quiz
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
          placeholder="Quiz title"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 font-heading text-lg font-semibold focus:bg-surface"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          placeholder="Short description (optional)"
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm focus:bg-surface"
        />
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onChange={(nq) => setQuestion(i, nq)}
            onRemove={removeQuestion}
            onMove={moveQuestion}
            onDuplicate={duplicateQuestion}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-center">
        <Button variant="outline" onClick={addQuestion} disabled={questions.length >= 50}>
          <Icon.Plus width={16} height={16} />
          Add question
        </Button>
      </div>
    </HubLayout>
  );
}
