import React, { useState } from "react";
import { ActivityIndicator, BackHandler, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

const GAME_URL = "https://riverroom-live.onrender.com";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const webRef = React.useRef<WebView>(null);

  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      webRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <ExpoStatusBar style="light" backgroundColor="#08110d" />
      <StatusBar barStyle="light-content" backgroundColor="#08110d" />
      <View style={styles.topbar}>
        <View style={styles.brandMark}><Text style={styles.markText}>R</Text></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brand}>RIVERROOM</Text>
          <Text style={styles.sub}>TEXAS HOLD'EM · FRIENDS TABLE</Text>
        </View>
        <View style={styles.virtual}><Text style={styles.virtualText}>VIRTUAL CHIPS</Text></View>
      </View>
      {failed ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Table connection unavailable</Text>
          <Text style={styles.errorCopy}>RiverRoom may be waking up. Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retry} onPress={() => { setFailed(false); setLoading(true); setReload(x => x + 1); }}>
            <Text style={styles.retryText}>RETRY CONNECTION</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.web}>
          {loading && <View style={styles.loader}><ActivityIndicator size="large" color="#b7f36b" /><Text style={styles.loadingText}>Opening your table…</Text></View>}
          <WebView
            key={reload}
            ref={webRef}
            source={{ uri: GAME_URL }}
            onLoadStart={() => { setLoading(true); setFailed(false); }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setFailed(true); }}
            onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) { setLoading(false); setFailed(true); } }}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
            originWhitelist={["https://*", "http://*"]}
            style={styles.webview}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:"#08110d"},
  topbar:{height:62,backgroundColor:"#0b1510",borderBottomWidth:1,borderBottomColor:"#263a32",paddingHorizontal:15,flexDirection:"row",alignItems:"center",gap:10},
  brandMark:{width:34,height:34,borderRadius:10,backgroundColor:"#b7f36b",alignItems:"center",justifyContent:"center"},
  markText:{fontSize:21,fontWeight:"900",color:"#142014"},
  brandCopy:{flex:1},
  brand:{fontSize:14,fontWeight:"900",letterSpacing:2,color:"#f2f6f2"},
  sub:{fontSize:8,letterSpacing:1.1,color:"#9aaba2",marginTop:3},
  virtual:{borderWidth:1,borderColor:"#405b40",borderRadius:20,paddingVertical:6,paddingHorizontal:9},
  virtualText:{fontSize:8,fontWeight:"800",letterSpacing:1,color:"#b7f36b"},
  web:{flex:1},
  webview:{flex:1,backgroundColor:"#0b1110"},
  loader:{position:"absolute",zIndex:2,top:0,bottom:0,left:0,right:0,alignItems:"center",justifyContent:"center",backgroundColor:"#0b1110"},
  loadingText:{color:"#c4d8c7",fontSize:12,marginTop:12},
  error:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:"#0b1110"},
  errorTitle:{color:"#f2f6f2",fontSize:20,fontWeight:"800",textAlign:"center"},
  errorCopy:{color:"#9aaba2",fontSize:13,lineHeight:20,textAlign:"center",marginTop:10,maxWidth:320},
  retry:{backgroundColor:"#b7f36b",paddingHorizontal:20,paddingVertical:13,borderRadius:10,marginTop:22},
  retryText:{color:"#142014",fontWeight:"900",fontSize:11,letterSpacing:1}
});
