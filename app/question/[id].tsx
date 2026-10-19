import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import * as api from "@/lib/living/api";
import {
  ActionStatus,
  Body,
  Button,
  Busy,
  Card,
  Choices,
  Empty,
  Field,
  Page,
  Tag,
  Title,
  acquisitionOptions,
  useAction,
  useLivingQuery,
} from "@/components/living/ui";
export default function QuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useLivingQuery(["question", id], () => api.question(id));
  const answers = useLivingQuery(["answers", id], () => api.answers(id));
  const action = useAction();
  const [duration, setDuration] = useState("");
  const [context, setContext] = useState("");
  const [acquisition, setAcquisition] = useState("purchased");
  const [body, setBody] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  return (
    <Page
      back
      eyebrow="Ask someone who has used it"
      title="Experience can help."
      sub="Specific context makes an answer useful. Describe what happened without promising someone else the same result."
    >
      <Busy loading={q.isLoading} error={q.error} />
      {q.data ? (
        <Card tone="gold">
          <Tag text="COMMUNITY QUESTION" />
          <Title>{q.data.body}</Title>
          <Body>
            {q.data.author_name} ·{" "}
            {q.data.context || "No additional context provided"}
          </Body>
        </Card>
      ) : null}
      <Title>What people experienced</Title>
      <Busy loading={answers.isLoading} error={answers.error} />
      {answers.data?.map((a) => (
        <Card key={a.id}>
          <Tag text="Self-reported experience" />
          <Body>
            {a.author_name} · {a.duration} · {a.acquisition.replace("_", " ")}
          </Body>
          <Body>{a.body}</Body>
          <Body>Context: {a.context}</Body>
          {a.uncertainty ? <Body>Still uncertain: {a.uncertainty}</Body> : null}
        </Card>
      ))}
      {answers.data?.length === 0 ? (
        <Empty
          title="An honest question deserves context."
          body="There are no answers yet. Relevant users can contribute when they have useful experience."
        />
      ) : null}
      <Card>
        <Title>Share what happened to you</Title>
        <Field
          label="How long did you use it?"
          value={duration}
          onChange={setDuration}
        />
        <Field label="Your context" value={context} onChange={setContext} />
        <Choices
          label="How did you obtain it?"
          value={acquisition}
          onChange={setAcquisition}
          options={acquisitionOptions}
        />
        <Field
          label="What changed? What would you do differently?"
          value={body}
          onChange={setBody}
          multiline
        />
        <Field
          label="What are you uncertain about?"
          value={uncertainty}
          onChange={setUncertainty}
        />
        <Body>
          Your answer inherits the question’s audience. It is self-reported
          context, not automatically verified evidence.
        </Body>
        <Button
          label="Publish my answer"
          disabled={
            !duration.trim() ||
            !context.trim() ||
            body.trim().length < 10 ||
            action.isPending
          }
          onPress={() =>
            action.run(async () => {
              await api.addAnswer({
                question_id: id,
                duration,
                context,
                acquisition,
                body,
                uncertainty,
              });
              setBody("");
            })
          }
        />
        <ActionStatus action={action} />
      </Card>
    </Page>
  );
}
