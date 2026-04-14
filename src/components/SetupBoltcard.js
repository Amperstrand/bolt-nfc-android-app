import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import nfcManager, {Ndef, NfcTech} from 'react-native-nfc-manager';
import {Card, Text, ActivityIndicator, Button, Title} from 'react-native-paper';
import Ntag424 from '../class/Ntag424';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import {normalizeCardConfig, validateCardConfig} from '../utils/CardConfig';
import {provisionCard, DEFAULT_KEY} from '../utils/provisionCard';

const SetupStep = {
  Init: 1,
  Restart: 2,
  HoldCard: 3,
  ReadingUid: 4,
  RequestingKeys: 5,
  WritingCard: 6,
};

const WithStep = ({step, current, children}) => {
  return step === current ? children : null;
};
export default function SetupBoltcard({url}) {
  const [step, setStep] = useState(SetupStep.Init);
  const [readingNfc, setReadingNfc] = useState(false);
  const [error, setError] = useState('');

  //output
  const [tagTypeError, setTagTypeError] = useState('');
  const [cardUID, setCardUID] = useState('');
  const [ndefRead, setNdefRead] = useState('');
  const [ndefWritten, setNdefWritten] = useState(false);
  const [key0Changed, setKey0Changed] = useState(false);
  const [key1Changed, setKey1Changed] = useState(false);
  const [key2Changed, setKey2Changed] = useState(false);
  const [key3Changed, setKey3Changed] = useState(false);
  const [key4Changed, setKey4Changed] = useState(false);
  const [writekeys, setWriteKeys] = useState('');
  const [testp, setTestp] = useState('');
  const [testc, setTestc] = useState('');
  const [testBolt, setTestBolt] = useState('');
  const [writingCard, setWritingCard] = useState(false);

  if (!url) {
    return (
      <View style={{padding: 20}}>
        <Text>No valid URL passed.</Text>
      </View>
    );
  }

  useFocusEffect(
    React.useCallback(() => {
      readNfc();

      return () => {
        nfcManager.cancelTechnologyRequest();
      };
    }, []),
  );

  const reset = () => {
    setError('');
    setTagTypeError('');
    setCardUID('');
    setKey0Changed(false);
    setKey1Changed(false);
    setKey2Changed(false);
    setKey3Changed(false);
    setKey4Changed(false);
    setNdefWritten(false);
    setWriteKeys('');
    setTestp('');
    setTestc('');
    setTestBolt('');
    setWritingCard(false);
    nfcManager.cancelTechnologyRequest();
    setReadingNfc(false);
  };

  const byteSize = str => new Blob([str]).size;

  const readNfc = async () => {
    reset();
    setStep(SetupStep.HoldCard);

    try {
      setReadingNfc(true);
      await nfcManager.requestTechnology(NfcTech.IsoDep, {
        alertMessage:
          'Ready to write card. Hold NFC card to phone until all keys are changed.',
      });
      setStep(SetupStep.ReadingUid);
      const tag = await nfcManager.getTag();
      if (!tag) throw new Error('Error reading card. No tag detected');
      let uid = tag?.id;
      setCardUID(uid ? uid : '');

      await Ntag424.isoSelectFileApplication();
      const key1Version = await Ntag424.getKeyVersion('01');
      if (key1Version != '00')
        throw new Error('TRY AGAIN AFTER RESETING YOUR CARD!');

      const key0 = DEFAULT_KEY;
      if (byteSize(uid) == 8) {
        //random uid
        //get the real uid by authenticating first
        await Ntag424.AuthEv2First('00', key0);
        uid = await Ntag424.getCardUid();
      }

      setStep(SetupStep.RequestingKeys);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          UID: uid,
        }),
      });
      if (!response.ok) {
        console.log(response);
        console.log(await response.text());
        throw new Error('Error fetching the keys');
      }
      const json = await response.json();
      console.log(json);
      const config = normalizeCardConfig(json);

      if (!validateCardConfig(config)) {
        throw new Error('Error fetching the keys');
      }

      setWritingCard(true);
      setStep(SetupStep.WritingCard);

      const onProgress = (event, data) => {
        switch (event) {
          case 'ndefWritten':
            setNdefWritten(true);
            break;
          case 'uidRead':
            uid = data;
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
        error = ex.message ? ex.message : ex.constructor.name;
      }
      if (
        error == 'You can only issue one request at a time' ||
        error == 'UserCancel' ||
        error == 'Duplicated registration'
      ) {
        setStep(SetupStep.Restart);
        return;
      }
      error = 'NFC Error: ' + error;
      setTagTypeError(error);
      setStep(SetupStep.WritingCard);
    } finally {
      setWritingCard(false);
      nfcManager.cancelTechnologyRequest();
      setReadingNfc(false);
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
    <Card
      style={{
        marginVertical: 20,
        marginHorizontal: 10,
        textAlign: 'center',
        paddingVertical: 30,
      }}>
      <WithStep step={SetupStep.Init} current={step}>
        <Card.Content>
          <ActivityIndicator size="large" />
        </Card.Content>
      </WithStep>
      <WithStep step={SetupStep.Restart} current={step}>
        <Card.Content>
          <Button onPress={readNfc}>Start programming the card</Button>
        </Card.Content>
      </WithStep>
      {readingNfc && (
        <Card.Content>
          <Title style={styles.textCenter}>
            Hold your card until it's finished
          </Title>
        </Card.Content>
      )}
      <WithStep step={SetupStep.HoldCard} current={step}>
        <Card.Content>
          <View>
            <Ionicons
              name="card"
              size={50}
              color="green"
              style={{alignSelf: 'center'}}
            />
            <Text
              style={{fontSize: 20, textAlign: 'center', borderColor: 'black'}}>
              Ready to write card. Hold NFC card to phone until all keys are
              changed.
            </Text>
          </View>
        </Card.Content>
      </WithStep>
      <WithStep step={SetupStep.ReadingUid} current={step}>
        <Card.Content>
          <View>
            <Ionicons
              name="card"
              size={50}
              color="green"
              style={{alignSelf: 'center'}}
            />
            <Text
              style={{fontSize: 20, textAlign: 'center', borderColor: 'black'}}>
              Reading your card UID.
            </Text>
            <ActivityIndicator />
          </View>
        </Card.Content>
      </WithStep>
      <WithStep step={SetupStep.RequestingKeys} current={step}>
        <Card.Content>
          <View>
            <Ionicons
              name="card"
              size={50}
              color="green"
              style={{alignSelf: 'center'}}
            />
            <Text
              style={{fontSize: 20, textAlign: 'center', borderColor: 'black'}}>
              Requesting new keys.
            </Text>
            <ActivityIndicator />
          </View>
        </Card.Content>
      </WithStep>
      <WithStep step={SetupStep.WritingCard} current={step}>
        <View>
          <Card.Content>
            {writingCard && (
              <View>
                <Text>Writing card...</Text>
                <ActivityIndicator />
              </View>
            )}
            <Title>Output</Title>
            {tagTypeError && (
              <Text>
                Tag Type Error: {tagTypeError}
                <Ionicons name="alert-circle" size={20} color="red" />
              </Text>
            )}
            {ndefWritten && (
              <Text>
                NDEF written: {ndefWritten}
                {showTickOrError(ndefWritten)}
              </Text>
            )}
            <Text>Key 0 {showTickOrError(key0Changed)}</Text>
            <Text>Key 1 {showTickOrError(key1Changed)}</Text>
            <Text>Key 2 {showTickOrError(key2Changed)}</Text>
            <Text>Key 3 {showTickOrError(key3Changed)}</Text>
            <Text>Key 4 {showTickOrError(key4Changed)}</Text>
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
            {!writingCard && <Button onPress={readNfc}>Write again</Button>}
          </Card.Content>
        </View>
      </WithStep>
    </Card>
  );
}

const styles = StyleSheet.create({
  textCenter: {
    textAlign: 'center',
  },
});
