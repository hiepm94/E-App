import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import * as Speech from 'expo-speech';
import { apiFetch } from '../api';
import { THEME } from '../theme';

export default function ParrotScreen() {
  const [parrots, setParrots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentence, setSentence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedParrot, setSelectedParrot] = useState(null);

  const fetchParrots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/hub/parrot');
      setParrots(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchParrots(); }, [fetchParrots]);

  const handleAdd = async () => {
    const s = sentence.trim();
    if (!s) return;
    setSubmitting(true);
    try {
      await apiFetch('/hub/parrot', {
        method: 'POST',
        body: JSON.stringify({ sentence: s, tags: [] }),
      });
      setSentence('');
      fetchParrots();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRandom = async () => {
    setSubmitting(true);
    try {
      await apiFetch('/hub/parrot/random', { method: 'POST' });
      fetchParrots();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch(`/hub/parrot/${id}`, { method: 'DELETE' });
      setParrots(prev => prev.filter(p => p.id !== id));
      setSelectedParrot(null);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const playAudio = (text) => {
    Speech.stop();
    Speech.speak(text, { language: 'en', rate: 0.95 });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelectedParrot(item)}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <Text style={styles.sentence} numberOfLines={2}>{item.sentence}</Text>
        <TouchableOpacity onPress={() => playAudio(item.sentence)} style={styles.playBtn}>
          <Text style={styles.playText}>▶️</Text>
        </TouchableOpacity>
      </View>
      {item.tags?.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.map(t => <Text key={t} style={styles.tagBadge}>{t}</Text>)}
        </View>
      )}
      {item.explanation ? (
        <Text style={styles.previewExplanation} numberOfLines={2}>{item.explanation}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Parrot</Text>
        <Text style={styles.subtitle}>Paste an idiom, grammar rule, or sentence.</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. It's raining cats and dogs..." 
          placeholderTextColor={THEME.colors.textMuted} 
          value={sentence} 
          onChangeText={setSentence} 
          multiline 
          maxLength={500} 
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={[styles.btn, { flex: 3 }]} onPress={handleAdd} disabled={submitting}>
            <Text style={styles.btnText}>{submitting ? 'Analyzing...' : '✨ Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { flex: 2, backgroundColor: THEME.colors.secondary }]} onPress={handleRandom} disabled={submitting}>
            <Text style={styles.btnText}>{submitting ? 'Generating...' : '🎲 Random'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Library ({parrots.length})</Text>

      {loading ? <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={parrots}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No sentences yet. Add something brilliant!</Text>}
        />
      )}

      {selectedParrot && (
        <Modal animationType="slide" visible={!!selectedParrot} onRequestClose={() => setSelectedParrot(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalSentence}>{selectedParrot.sentence}</Text>
                <TouchableOpacity onPress={() => playAudio(selectedParrot.sentence)} style={styles.playBtnLarge}>
                  <Text style={styles.playTextLarge}>🔊</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tagsContainerModal}>
                {selectedParrot.tags?.map(t => <Text key={t} style={styles.tagBadgeLarge}>{t}</Text>)}
              </View>

              <ScrollView style={styles.explanationScroll} nestedScrollEnabled={true}>
                <Text style={styles.explanationTitle}>AI Contextual Explanation</Text>
                <Text style={styles.explanationText}>{selectedParrot.explanation || "No explanation recorded."}</Text>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btnAction, {backgroundColor: THEME.colors.surfaceLight, borderWidth: 1, borderColor: THEME.colors.border}]} onPress={() => setSelectedParrot(null)}>
                  <Text style={[styles.btnActionText, {color: THEME.colors.onSurface}]}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnAction, {backgroundColor: THEME.colors.error}]} onPress={() => handleDelete(selectedParrot.id)}>
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
  label: { ...THEME.typography.h2, marginBottom: 4, color: THEME.colors.primaryVariant },
  subtitle: { ...THEME.typography.body2, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.borderRadius.medium,
    padding: 16, marginBottom: 12, color: THEME.colors.onBackground, backgroundColor: THEME.colors.background,
    minHeight: 100, textAlignVertical: 'top', ...THEME.typography.body1
  },
  btn: { backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.medium, paddingVertical: 14, alignItems: 'center' },
  btnText: { ...THEME.typography.button },
  sectionTitle: { ...THEME.typography.h3, marginLeft: 16, marginBottom: 12, color: THEME.colors.onSurface },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  empty: { textAlign: 'center', color: THEME.colors.textMuted, marginTop: 40, ...THEME.typography.body1 },
  card: {
    backgroundColor: THEME.colors.surface, padding: 20, borderRadius: THEME.borderRadius.large,
    ...THEME.shadows.small, borderWidth: 1, borderColor: THEME.colors.border
  },
  sentence: { ...THEME.typography.h3, flex: 1, color: THEME.colors.onBackground, lineHeight: 26 },
  playBtn: { padding: 6, backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.pill, height: 36, width: 36, alignItems: 'center', justifyContent: 'center'},
  playBtnLarge: { padding: 12, backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.pill, marginLeft: 12},
  playText: { fontSize: 14, color: '#fff' },
  playTextLarge: { fontSize: 20, color: '#fff' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tagBadge: { backgroundColor: THEME.colors.surfaceLight, color: THEME.colors.primaryVariant, paddingHorizontal: 10, paddingVertical: 4, borderRadius: THEME.borderRadius.pill, fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)'},
  previewExplanation: { ...THEME.typography.body2, marginTop: 12, fontStyle: 'italic' },
  
  modalBg: { flex: 1, backgroundColor: THEME.colors.background },
  modalBox: { flex: 1, backgroundColor: THEME.colors.background, padding: 24, gap: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalSentence: { ...THEME.typography.h2, flex: 1, lineHeight: 34, color: THEME.colors.primaryVariant },
  tagsContainerModal: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tagBadgeLarge: { backgroundColor: THEME.colors.surfaceLight, color: THEME.colors.primaryVariant, paddingHorizontal: 16, paddingVertical: 6, borderRadius: THEME.borderRadius.pill, fontSize: 14, fontWeight: '700', borderWidth: 1, borderColor: THEME.colors.border },
  
  explanationScroll: { backgroundColor: THEME.colors.background, padding: 16, borderRadius: THEME.borderRadius.medium, borderWidth: 1, borderColor: THEME.colors.border },
  explanationTitle: { ...THEME.typography.body2, fontWeight: '800', color: THEME.colors.primary, textTransform: 'uppercase', marginBottom: 8 },
  explanationText: { ...THEME.typography.body1, lineHeight: 28 },
  
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnAction: { flex: 1, padding: 16, borderRadius: THEME.borderRadius.medium, alignItems: 'center' },
  btnActionText: { ...THEME.typography.button, color: THEME.colors.onPrimary },
});
