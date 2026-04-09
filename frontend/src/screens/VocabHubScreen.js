import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, Image } from 'react-native';
import * as Speech from 'expo-speech';
import { apiFetch } from '../api';
import { THEME } from '../theme';

export default function VocabHubScreen() {
  const [vocabs, setVocabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);

  const fetchVocabs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/hub/vocab');
      setVocabs(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVocabs(); }, [fetchVocabs]);

  const handleAdd = async () => {
    const word = newWord.trim();
    if (!word) return;
    setSubmitting(true);
    try {
      await apiFetch('/hub/vocab', {
        method: 'POST',
        body: JSON.stringify({ word, context: context.trim() }),
      });
      setNewWord('');
      setContext('');
      fetchVocabs();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch(`/hub/vocab/${id}`, { method: 'DELETE' });
      setVocabs(prev => prev.filter(v => v.id !== id));
      setSelectedWord(null);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const playAudio = (text) => {
    Speech.stop();
    Speech.speak(text, { language: 'en', rate: 0.95 });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelectedWord(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.word}>{item.word}</Text>
        <TouchableOpacity onPress={() => playAudio(item.word)} style={styles.playBtn}>
          <Text style={styles.playText}>▶️</Text>
        </TouchableOpacity>
      </View>
      {item.pronunciation ? <Text style={styles.pronunciation}>/{item.pronunciation}/</Text> : null}
      
      {item.scraped_media?.images?.[0] && (
        <Image style={styles.thumbnail} source={{uri: item.scraped_media.images[0]}} />
      )}

      {item.synonyms?.length > 0 && (
        <View style={styles.chipRow}>
           <Text style={styles.chip}>Synonyms: {item.synonyms.slice(0, 3).join(', ')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Learn New Vocabulary</Text>
        <TextInput 
          style={styles.input} 
          placeholderTextColor={THEME.colors.textMuted} 
          placeholder="Enter a word (e.g. effervescent)" 
          value={newWord} onChangeText={setNewWord} maxLength={60} autoCapitalize="none" 
        />
        <TextInput 
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
          multiline
          placeholderTextColor={THEME.colors.textMuted} 
          placeholder="Where did you see it?" 
          value={context} onChangeText={setContext} maxLength={500} 
        />
        <TouchableOpacity style={styles.btn} onPress={handleAdd} disabled={submitting}>
          <Text style={styles.btnText}>{submitting ? 'Analyzing...' : '+ Add to Library'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Library ({vocabs.length} items)</Text>

      {loading ? <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={vocabs}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No words yet. Star building your lexical resource!</Text>}
        />
      )}

      {selectedWord && (
        <Modal animationType="slide" visible={!!selectedWord} onRequestClose={() => setSelectedWord(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modalBox}>
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalWord}>{selectedWord.word}</Text>
                <TouchableOpacity onPress={() => playAudio(selectedWord.word)} style={styles.playBtnLarge}>
                  <Text style={styles.playTextLarge}>🔊</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalPronunciation}>/{selectedWord.pronunciation}/</Text>

              <ScrollView style={{flex: 1, marginTop: 16}} showsVerticalScrollIndicator={false}>

                {/* Images Carousel */}
                {selectedWord.scraped_media?.images?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionHead}>Visuals</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {selectedWord.scraped_media.images.map((imgUrl, i) => (
                        <Image key={i} source={{uri: imgUrl}} style={styles.carouselImage} />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Example Sentences */}
                {selectedWord.example_sentences?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionHead}>Example Sentences</Text>
                    {selectedWord.example_sentences.map((sentence, i) => (
                      <View key={i} style={styles.contextBox}>
                        <Text style={styles.contextText}>• {sentence}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* News Context */}
                {selectedWord.scraped_media?.news?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionHead}>News</Text>
                    {selectedWord.scraped_media.news.map((n, i) => (
                      <Text key={i} style={styles.newsHeadline}>"{n}"</Text>
                    ))}
                  </View>
                )}

                {/* Synonyms & Collocations */}
                <View style={{flexDirection: 'row', gap: 16}}>
                  {selectedWord.synonyms?.length > 0 && (
                    <View style={[styles.section, {flex: 1}]}>
                      <Text style={styles.sectionHead}>Synonyms</Text>
                      <View style={styles.chipRowLarge}>{selectedWord.synonyms.map(s => <Text key={s} style={styles.chipLarge}>{s}</Text>)}</View>
                    </View>
                  )}

                  {selectedWord.collocations?.length > 0 && (
                    <View style={[styles.section, {flex: 1}]}>
                      <Text style={styles.sectionHead}>Collocations</Text>
                      {selectedWord.collocations.map(c => <Text key={c} style={styles.listItem}>• {c}</Text>)}
                    </View>
                  )}
                </View>
                
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btnAction, {backgroundColor: THEME.colors.surfaceLight, borderWidth: 1, borderColor: THEME.colors.border}]} onPress={() => setSelectedWord(null)}>
                  <Text style={[styles.btnActionText, {color: THEME.colors.onSurface}]}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnAction, {backgroundColor: THEME.colors.error}]} onPress={() => handleDelete(selectedWord.id)}>
                  <Text style={styles.btnActionText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  form: {
    backgroundColor: THEME.colors.surface, margin: 16, padding: 16,
    borderRadius: THEME.borderRadius.large, ...THEME.shadows.medium,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  label: { ...THEME.typography.h2, marginBottom: 12, color: THEME.colors.primaryVariant },
  input: {
    borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.borderRadius.medium,
    padding: 14, marginBottom: 10, color: THEME.colors.onBackground, backgroundColor: THEME.colors.background,
    ...THEME.typography.body1
  },
  btn: { backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.medium, paddingVertical: 14, alignItems: 'center' },
  btnText: { ...THEME.typography.button },
  sectionTitle: { ...THEME.typography.h3, marginLeft: 16, marginBottom: 8, color: THEME.colors.onSurface },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  empty: { textAlign: 'center', color: THEME.colors.textMuted, marginTop: 40, ...THEME.typography.body1 },
  
  card: {
    backgroundColor: THEME.colors.surface, padding: 20, borderRadius: THEME.borderRadius.large,
    ...THEME.shadows.small, borderWidth: 1, borderColor: THEME.colors.border
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  word: { ...THEME.typography.h2, color: THEME.colors.primaryVariant },
  pronunciation: { ...THEME.typography.body2, fontStyle: 'italic', marginBottom: 12, marginTop: 4 },
  thumbnail: { width: '100%', height: 120, borderRadius: THEME.borderRadius.medium, marginBottom: 12, backgroundColor: THEME.colors.surfaceLight },
  playBtn: { padding: 8, backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.pill, height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
  playText: { fontSize: 14, color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { color: THEME.colors.textMuted, fontSize: 13, fontWeight: '600' },
  
  modalBg: { flex: 1, backgroundColor: THEME.colors.background },
  modalBox: { flex: 1, backgroundColor: THEME.colors.background, padding: 24, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalWord: { ...THEME.typography.h1, color: THEME.colors.primaryVariant },
  modalPronunciation: { ...THEME.typography.body1, fontStyle: 'italic', color: THEME.colors.textMuted },
  playBtnLarge: { padding: 12, backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.pill },
  playTextLarge: { fontSize: 20, color: '#fff' },
  
  section: { marginBottom: 24 },
  sectionHead: { ...THEME.typography.body2, fontWeight: '800', color: THEME.colors.primary, textTransform: 'uppercase', marginBottom: 10 },
  carouselImage: { width: 140, height: 100, borderRadius: THEME.borderRadius.medium, marginRight: 12, backgroundColor: THEME.colors.surfaceLight },
  
  contextBox: { padding: 12, backgroundColor: THEME.colors.surfaceLight, borderRadius: THEME.borderRadius.medium, marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.border },
  contextText: { ...THEME.typography.body1, lineHeight: 24, color: THEME.colors.onSurface },
  
  newsHeadline: { ...THEME.typography.body1, fontStyle: 'italic', paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: THEME.colors.secondary, marginBottom: 12, lineHeight: 24 },
  
  chipRowLarge: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipLarge: { backgroundColor: THEME.colors.surfaceLight, color: THEME.colors.primaryVariant, paddingHorizontal: 12, paddingVertical: 6, borderRadius: THEME.borderRadius.pill, fontSize: 14, fontWeight: '700', borderWidth: 1, borderColor: THEME.colors.border },
  listItem: { ...THEME.typography.body1, marginBottom: 6, color: THEME.colors.onSurface },
  
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btnAction: { flex: 1, padding: 16, borderRadius: THEME.borderRadius.medium, alignItems: 'center' },
  btnActionText: { ...THEME.typography.button, color: THEME.colors.onPrimary },
});
