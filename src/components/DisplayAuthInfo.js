
import { useEffect, useState } from 'react';
import { ActivityIndicator, NativeModules, StyleSheet, Text, View, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { normalizeCardConfig, validateCardConfig } from '../utils/CardConfig';

export default function DisplayAuthInfo(props) {
    
    const {data, keys, setKeys, lnurlw_base, setlnurlw_base, setReadyToWrite, cardName, setCardName, privateUID, setPrivateUID} = props;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState();

    //Load the auth info from the URL
    useEffect(() => {
        if(data && data != "") {
            setLoading(true);
            fetch(data)
                .then((response) => response.json())
                .then((json) => {
                    setLoading(false);
                    if(json.status == "ERROR") {
                        setError(json.reason);
                        return;
                    }
                    const config = normalizeCardConfig(json);
                    if(!validateCardConfig(config)) {
                        setError("The JSON response must contain lnurlw_base, k0, k1, k2, k3, k4 ");
                        return;
                    }
                    
                    setlnurlw_base(config.lnurlw_base);
                    if(config.cardName) setCardName(config.cardName);
                    setKeys([config.k0, config.k1, config.k2, config.k3, config.k4]);
                    setPrivateUID(config.privateUID);

                    setReadyToWrite(true);
                    
                })
                .catch((error) => {
                    setLoading(false);
                    console.error(error);
                    setError(error.message);
                });
        }
    }, [data])


    const key0display = keys[0] ? keys[0].substring(0, 4)+"............"+ keys[0].substring(28) : "pending...";
    const key1display = keys[1] ? keys[1].substring(0, 4)+"............"+ keys[1].substring(28) : "pending...";
    const key2display = keys[2] ? keys[2].substring(0, 4)+"............"+ keys[2].substring(28) : "pending...";
    const key3display = keys[3] ? keys[3].substring(0, 4)+"............"+ keys[3].substring(28) : "pending...";
    const key4display = keys[4] ? keys[4].substring(0, 4)+"............"+ keys[4].substring(28) : "pending...";

    return(
        <>
            {loading ? 
                <Text><ActivityIndicator /> Loading.... </Text>
                :
                    !error ? 
                        <View>
                            <Text style={styles.monospace}>lnurl: {lnurlw_base}</Text>
                            <Text style={styles.monospace}>card_name: {cardName}</Text>
                            <Text style={styles.monospace}>Key 0: {key0display}</Text>
                            <Text style={styles.monospace}>Key 1: {key1display}</Text>
                            <Text style={styles.monospace}>Key 2: {key2display}</Text>
                            <Text style={styles.monospace}>Key 3: {key3display}</Text>
                            <Text style={styles.monospace}>Key 4: {key4display}</Text>
                            <Text style={styles.monospace}>Private UID: {privateUID ? "Yes" : "No"}</Text>
                            {privateUID &&
                                <Text style=""><Ionicons name="alert-circle"  size={20} color="orange" /> Private UID cannot be undone. See the help section for more details</Text>
                            }
                        </View>
                    :
                    <View>
                        <Text>URL: {data}</Text>
                        <Text><Ionicons name="alert-circle"  size={20} color="red" /> Error: {error}</Text>
                    </View>
            }
            
        </>
    );

}


const styles = StyleSheet.create({
    paragraph: {
      marginBottom:5
    },
    monospace: {
      fontFamily: Platform.OS === 'ios' ? "Courier New" : "monospace"
    }
  });