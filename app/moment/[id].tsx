import { useLocalSearchParams, useRouter } from "expo-router";

import { StoryViewer } from "@/components/social-home/StoryViewer";
import { useSocialBoard } from "@/components/social-home/useBoard";

export default function Moment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const board = useSocialBoard();
  const startId = board.people.some((person) => person.authorId === id)
    ? id
    : board.people.find((person) => person.moments.some((moment) => moment.id === id))?.authorId || board.people[0]?.authorId;
  if (!startId) return null;
  return (
    <StoryViewer
      people={board.people}
      startId={startId}
      onSeen={board.mark}
      onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    />
  );
}
