import { Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { foundingMember } from "@/lib/membership";
import { fonts } from "@/constants/theme";
export function FoundingLabel({ id }: { id?: string | null }) {
  const q = useQuery({
    queryKey: ["founding-member", id],
    queryFn: () => foundingMember(id!),
    enabled: !!id && /^[0-9a-f-]{36}$/i.test(id),
    staleTime: 60000,
  });
  return q.data ? (
    <Text
      style={{
        fontFamily: fonts.semibold,
        fontSize: 10,
        color: "#89641C",
        letterSpacing: 0.3,
      }}
    >
      FOUNDING MEMBER
    </Text>
  ) : null;
}
