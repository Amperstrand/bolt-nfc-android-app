import {useFocusEffect, useNavigation} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import {
  Button,
  NativeEventEmitter,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import Dialog from 'react-native-dialog';
import {Card, Title} from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NfcManager, {NfcTech, Ndef} from 'react-native-nfc-manager';
import DisplayAuthInfo from '../components/DisplayAuthInfo';
import Ntag424 from '../class/Ntag424';
import {provisionCard, DEFAULT_KEY} from '../utils/provisionCard';

export default function CreateBoltcardScreen({route}) {
  const {data, timestamp} = route.params;
  const navigation = useNavigation();

  const [promptVisible, setPromptVisible] = useState(false);
  const [pasteUrlValue, setPasteUrlValue] = useState();

  //setup
  const [keys, setKeys] = useState([]);
  const [lnurlw_base, setlnurlw_base] = useState();
  const [cardName, setCardName] = useState();
  const [readyToWrite, setReadyToWrite] = useState(false);
  const [writeMode, setWriteMode] = useState(false);

  //output
  const [cardUID, setCardUID] = useState();
  const [tagname, setTagname] = useState();
  const [tagTypeError, setTagTypeError] = useState();

  const [key0Changed, setKey0Changed] = useState();
  const [key1Changed, setKey1Changed] = useState();
  const [key2Changed, setKey2Changed] = useState();
  const [key3Changed, setKey3Changed] = useState();
  const [key4Changed, setKey4Changed] = useState();
  const [privateUID, setPrivateUID] = useState(false);

  const [ndefWritten, setNdefWritten] = useState();
  const [writekeys, setWriteKeys] = useState();
  const [ndefRead, setNdefRead] = useState();
  const [testp, setTestp] = useState();
  const [testc, setTestc] = useState();
  const [testBolt, setTestBolt] = useState();

  const scanQRCode = () => {
    navigation.navigate('ScanScreen', {backScreen: 'CreateBoltcardScreen'});
  };

  const resetAll = () => {
    setKeys([]);
    setReadyToWrite(false);
    setWriteMode(false);
    resetOutput();
    navigation.navigate('CreateBoltcardScreen', {data: null});
  };

  const resetOutput = () => {
    setTagTypeError(null);
    setTagname(null);
    setCardUID(null);
    setKey0Changed(null);
    setKey1Changed(null);
    setKey2Changed(null);
    setKey3Changed(null);
    setKey4Changed(null);
    setNdefWritten(null);
    setWriteKeys(null);
  };

  const writeAgain = async () => {
    resetOutput();
    console.log(keys);
    // NativeModules.MyReactModule.setCardMode('createBoltcard');
    setWriteMode(true);
    try {
      // register for the NFC tag with NDEF in it
      await NfcManager.requestTechnology(NfcTech.IsoDep, {
        alertMessage:
          'Ready to write card. Hold NFC card to phone until all keys are changed.',
      });

      await Ntag424.isoSelectFileApplication();
      const key1Version = await Ntag424.getKeyVersion('01');
      if (key1Version != '00')
        throw new Error('TRY AGAIN AFTER RESETING YOUR CARD!');

      const config = {
        k0: keys[0],
        k1: keys[1],
        k2: keys[2],
        k3: keys[3],
        k4: keys[4],
        lnurlw_base,
        privateUID,
      };

      const onProgress = (event, data) => {
        switch (event) {
          case 'ndefWritten':
            setNdefWritten('success');
            break;
          case 'uidRead':
            setCardUID(data);
            break;
          case 'keyChanged':
            if (data === 0) setKey0Changed(true);
            if (data === 1) setKey1Changed(true);
            if (data === 2) setKey2Changed(true);
            if (data === 3) setKey3Changed(true);
            if (data === 4) setKey4Changed(true);
            break;
          case 'allKeysChanged':
            setWriteKeys('success');
            break;
          case 'ndefRead':
            setNdefRead(data);
            break;
          case 'testComplete':
            setTestp(data.pTest);
            setTestc(data.cTest);
            break;
        }
      };

      const result = await provisionCard({
        config,
        ntag: Ntag424,
        ndef: Ndef,
        onProgress,
      });

      //fire off the bolt service test (not awaited)
      fetch(result.httpsLNURL)
        .then(response => {
          if (!response.ok) {
            throw new Error(response.statusText);
          }
          return response.json();
        })
        .then(() => {
          setTestBolt('success');
        })
        .catch(error => {
          setTestBolt('Error: ' + error.message);
        });
    } catch (ex) {
      console.error('Oops!', ex);
      var error = ex;
      if (typeof ex === 'object') {
        error = 'NFC Error: ' + (ex.message ? ex.message : ex.constructor.name);
      }
      setTagTypeError(error);
    } finally {
      // stop the nfc scanning
      NfcManager.cancelTechnologyRequest();
      setWriteMode(false);
    }
  };

  const showTickOrError = good => {
    return good ? (
      <Ionicons name="checkmark-circle" size={20} color="green" />
    ) : (
      <Ionicons name="alert-circle" size={20} color="red" />
    );
  };

  return (
    <ScrollView>
      {!data || data == null ? (
        <>
          <Card style={styles.card}>
            <Card.Content>
              <Title>Scan QR Code</Title>
              <Text>
                Press the create card on LNBits or run the ./createboltcard
                command on your boltcard server
              </Text>
            </Card.Content>
            <Card.Actions style={{justifyContent: 'space-around'}}>
              <Button onPress={scanQRCode} title="Scan QR Code" />
              <Button
                onPress={() => setPromptVisible(true)}
                title="Paste Auth URL"
              />
            </Card.Actions>
          </Card>
          <Dialog.Container visible={promptVisible}>
            <Dialog.Title style={styles.textBlack}>Enter Auth URL</Dialog.Title>
            <Dialog.Description>
              Paste your Auth URL from the console here to import the keys.
            </Dialog.Description>
            <Dialog.Input
              style={styles.textBlack}
              label="Auth URL"
              onChangeText={setPasteUrlValue}
              value={pasteUrlValue}
            />
            <Dialog.Button
              label="Cancel"
              onPress={() => {
                setPromptVisible(false);
                setPasteUrlValue();
              }}
            />
            <Dialog.Button
              label="Continue"
              onPress={() => {
                setPromptVisible(false);
                setPasteUrlValue();
                navigation.navigate('CreateBoltcardScreen', {
                  data: pasteUrlValue,
                  timestamp: Date.now(),
                });
              }}
            />
          </Dialog.Container>
        </>
      ) : (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Check URLs and Keys</Title>
            <DisplayAuthInfo
              data={data}
              keys={keys}
              setKeys={setKeys}
              lnurlw_base={lnurlw_base}
              setlnurlw_base={setlnurlw_base}
              setReadyToWrite={setReadyToWrite}
              cardName={cardName}
              setCardName={setCardName}
              privateUID={privateUID}
              setPrivateUID={setPrivateUID}
            />
          </Card.Content>
          <Card.Actions style={{justifyContent: 'space-around'}}>
            <Button title="Reset" color="red" onPress={resetAll} />
            {readyToWrite && !writeMode && (
              <Button title="Write Card Now" onPress={writeAgain} />
            )}
          </Card.Actions>
        </Card>
      )}

      {writeMode && (
        <Card style={styles.card}>
          <Card.Content>
            <Ionicons name="card" size={50} color="green" />
            <Text
              style={{fontSize: 20, textAlign: 'center', borderColor: 'black'}}>
              Ready to write card. Hold NFC card to phone until all keys are
              changed.
            </Text>
          </Card.Content>
          <Card.Actions style={{justifyContent: 'center'}}>
            <Button
              title="Cancel"
              color="red"
              onPress={() => {
                NfcManager.cancelTechnologyRequest();
                setWriteMode(false);
                setReadyToWrite(true);
              }}
            />
          </Card.Actions>
        </Card>
      )}
      {(cardUID || tagTypeError) && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Output</Title>
            {tagTypeError && (
              <Text>
                Tag Type Error: {tagTypeError}
                <Ionicons name="alert-circle" size={20} color="red" />
              </Text>
            )}
            {cardUID && (
              <Text>
                Card UID: {cardUID}
                <Ionicons name="checkmark-circle" size={20} color="green" />
              </Text>
            )}
            {tagname && (
              <Text style={{lineHeight: 30, textAlignVertical: 'center'}}>
                Tag: {tagname}
                <Ionicons name="checkmark-circle" size={20} color="green" />
              </Text>
            )}
            {ndefWritten && (
              <Text>
                NDEF written: {ndefWritten}
                {showTickOrError(ndefWritten == 'success')}
              </Text>
            )}
            {writekeys && (
              <Text>
                Keys Changed: {writekeys}
                {showTickOrError(writekeys == 'success')}
              </Text>
            )}
            {ndefRead && <Text>Read NDEF: {ndefRead}</Text>}
            {testp && (
              <Text>
                Test PICC:{' '}
                {cardUID && cardUID.length == 8 ? (
                  <>test skipped {showTickOrError(true)}</>
                ) : (
                  <>
                    {testp}
                    {showTickOrError(testp == 'ok')}
                  </>
                )}
              </Text>
            )}
            {testc && (
              <Text>
                Test CMAC: {testc}
                {showTickOrError(testc == 'ok')}
              </Text>
            )}
            {testBolt && (
              <Text>
                Bolt call test: {testBolt}
                {showTickOrError(testBolt == 'success')}
              </Text>
            )}
          </Card.Content>
          <Card.Actions style={{justifyContent: 'space-around'}}>
            <Button title="Write Again" onPress={writeAgain} />
          </Card.Actions>
        </Card>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  card: {
    margin: 20,
  },
  textBlack: {
    color: '#000',
  },
});
