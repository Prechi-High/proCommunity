import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";

export function RenderJobWebView({ jobId }: { jobId: string | null }) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || Platform.OS === "web") return;
    setUri(Linking.createURL("/moment-render-host", { queryParams: { jobId } }));
  }, [jobId]);

  if (!jobId || !uri || Platform.OS === "web") return null;

  return (
    <View style={{ position: "absolute", width: 2, height: 2, opacity: 0.01 }} pointerEvents="none">
      <WebView source={{ uri }} javaScriptEnabled domStorageEnabled mediaPlaybackRequiresUserAction={false} />
    </View>
  );
}