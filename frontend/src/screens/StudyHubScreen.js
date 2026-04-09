import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Modal, Animated, Clipboard, Platform
} from 'react-native';
import { Audio } from 'expo-av';
import { apiFetch } from '../api';
import { THEME } from '../theme';

// ── Utility ───────────────────────────────────────────────────────────────
const getDirectDriveLink = (url) => {
  if (!url || !url.includes('drive.google.com')) return url;
  const m = url.match(/id=([^&]+)/) || url.match(/\/d\/([^/]+)/) || url.match(/\/open\?id=([^&]+)/);
  return m?.[1] ? `https://docs.google.com/uc?export=download&id=${m[1]}` : url;
};

// ── Study View (Transcript Digest) ──────────────────────────────────────────
const DigestView = ({ material, onToggleSound, isPlaying, isAudioLoading, playbackRate, onSetRate, openLink }) => {
  const [toast, setToast] = useState(null);
  const [savingVocab, setSavingVocab] = useState(false);
  const [savingParrot, setSavingParrot] = useState(false);
  const [selection, setSelection] = useState({ sIdx: null, start: null, end: null });

  const sentences = (material.content || "")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleWordTap = (sIdx, wIdx) => {
    setSelection(prev => {
      if (prev.sIdx !== sIdx) return { sIdx, start: wIdx, end: wIdx };
      const newStart = Math.min(prev.start, wIdx);
      const newEnd = Math.max(prev.end, wIdx);
      return { sIdx, start: newStart, end: newEnd };
    });
  };

  const getSelectedText = () => {
    if (selection.sIdx === null) return "";
    const sentence = sentences[selection.sIdx];
    const words = (sentence || "").split(/\s+/);
    return words.slice(selection.start, selection.end + 1).join(" ");
  };

  const handleAddVocab = async () => {
    const text = getSelectedText();
    if (!text) return;
    setSavingVocab(true);
    try {
      await apiFetch('/hub/vocab', {
        method: 'POST',
        body: JSON.stringify({ word: text, original_context: sentences[selection.sIdx] }),
      });
      showToast(`✅ '${text}' added to Vocab!`);
      setSelection({ sIdx: null, start: null, end: null });
    } catch (e) {
      showToast(`⚠️ Failed: ${e.message}`);
    } finally { setSavingVocab(false); }
  };

  const handleAddParrot = async () => {
    const text = getSelectedText();
    if (!text) return;
    setSavingParrot(true);
    try {
      await apiFetch('/hub/parrot', {
        method: 'POST',
        body: JSON.stringify({ sentence: text, tags: [] }),
      });
      showToast(`✅ Phrase added to Parrot!`);
      setSelection({ sIdx: null, start: null, end: null });
    } catch (e) {
      showToast(`⚠️ Failed: ${e.message}`);
    } finally { setSavingParrot(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.digestScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.digestHeader}>
          <Text style={styles.digestPartLabel}>{material.drive_audio_url ? '🎧 Listening Material' : '📄 Reading Material'}</Text>
          <Text style={styles.digestPartTitle}>{material.topic}</Text>
        </View>

        {material.drive_audio_url && (
          <View style={styles.audioControls}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity 
                  style={[styles.playBtn, { flex: 2 }, (isPlaying || isAudioLoading) && styles.audioBtnActive]} 
                  activeOpacity={0.2}
                  onPress={onToggleSound}
                  disabled={isAudioLoading}
                >
                  {isAudioLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.playBtnText}>⏳ ...</Text>
                    </View>
                  ) : (
                    <Text style={styles.playBtnText}>{isPlaying ? '⏸ Pause' : '▶ Play'}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.linkBtn} 
                  activeOpacity={0.2}
                  onPress={() => openLink(material.drive_audio_url)}
                >
                  <Text style={styles.linkBtnText}>🌐 Link</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.speedRow}>
              {[0.8, 1.0, 1.2, 1.5].map(rate => (
                <TouchableOpacity 
                  key={rate} 
                  style={[styles.speedBtn, playbackRate === rate && styles.speedBtnActive]}
                  activeOpacity={0.2}
                  onPress={() => onSetRate(rate)}
                >
                  <Text style={[styles.speedBtnText, playbackRate === rate && styles.speedBtnTextActive]}>{rate}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {toast && <View style={styles.toastBox}><Text style={styles.toastText}>{toast}</Text></View>}
        {(savingVocab || savingParrot) && <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginBottom: 10, marginTop: 10 }} />}

        <View style={styles.transcriptBox}>
          {sentences.map((sentence, sIdx) => (
            <Text key={sIdx} style={styles.transcriptSentence}>
              {sentence.split(/\s+/).map((word, wIdx) => {
                const isSelected = selection.sIdx === sIdx && wIdx >= selection.start && wIdx <= selection.end;
                return (
                  <Text
                    key={wIdx}
                    style={[styles.tappableWord, isSelected && styles.selectedWordHighlight]}
                    onPress={() => handleWordTap(sIdx, wIdx)}
                  >
                    {word}{' '}
                  </Text>
                );
              })}
            </Text>
          ))}
        </View>
        <View style={{ height: 160 }} />
      </ScrollView>

      {selection.sIdx !== null && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarTitle} numberOfLines={1}>"{getSelectedText()}"</Text>
          <View style={styles.selectionBarActions}>
            <TouchableOpacity style={styles.selectionBarBtn} activeOpacity={0.2} onPress={handleAddVocab} disabled={savingVocab}>
              <Text style={styles.selectionBarBtnText}>📚 Vocab</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectionBarBtn} activeOpacity={0.2} onPress={handleAddParrot} disabled={savingParrot}>
              <Text style={styles.selectionBarBtnText}>🦜 Parrot</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.selectionBarBtn, { backgroundColor: THEME.colors.error }]} 
              activeOpacity={0.2}
              onPress={() => setSelection({ sIdx: null, start: null, end: null })}
            >
              <Text style={styles.selectionBarBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ── Main StudyHubScreen ──────────────────────────────────────────────────────
export default function StudyHubScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Import Form
  const [importTopic, setImportTopic] = useState('');
  const [importContent, setImportContent] = useState('');
  const [importAudioUrl, setImportAudioUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // Audio Playback
  const [sound, setSound] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/ielts/study-materials');
      setItems(data);
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { return sound ? () => { sound.unloadAsync(); } : undefined; }, [sound]);

  // ── Helpers ──
  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const openLink = (url) => {
    if (!url) return showAlert('Error', 'No link available');
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(err => showAlert('Error', 'Could not open URL'));
    }
  };

  const handleImport = async () => {
    console.warn("TRACE: handleImport called", { topic: importTopic, contentLen: importContent.length });
    
    if (!importTopic.trim()) return showAlert('Error', 'Topic required');
    if (importContent.trim().length < 10) return showAlert('Error', 'Content too short (min 10 chars)');
    
    setImporting(true);
    try {
      const type = importAudioUrl.trim() ? 'listening' : 'reading';
      await apiFetch('/ielts/study-materials', {
        method: 'POST',
        body: JSON.stringify({ type, topic: importTopic, content: importContent, drive_audio_url: importAudioUrl }),
      });
      setShowImportModal(false);
      setImportTopic(''); setImportContent(''); setImportAudioUrl('');
      fetchItems();
    } catch (err) { 
        console.warn("TRACE: handleImport FAILED", err.message);
        showAlert('Error', err.message); 
    }
    finally { setImporting(false); }
  };

  const handleDelete = async (id) => {
    const previousItems = [...items];
    setItems(prev => prev.filter(m => m.id != id));
    try {
      await apiFetch(`/ielts/study-materials/${id}`, { method: 'DELETE' });
    } catch (err) { 
      setItems(previousItems);
      Alert.alert('Error', err.message); 
    }
  };

  const togglePlayback = async () => {
    if (!selectedMaterial?.drive_audio_url) return;
    try {
      if (sound) {
        if (playbackStatus?.isPlaying) await sound.pauseAsync();
        else await sound.playAsync();
      } else {
        setLoadingAudio(true);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: getDirectDriveLink(selectedMaterial.drive_audio_url) },
          { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true },
          setPlaybackStatus
        );
        setSound(newSound);
      }
    } catch (err) { 
      Alert.alert('Audio Error', 'Could not load audio. Ensure it is a public Drive link.'); 
    }
    finally { setLoadingAudio(false); }
  };

  const changeSpeed = async (speed) => {
    setPlaybackSpeed(speed);
    if (sound) await sound.setRateAsync(speed, true);
  };

  if (selectedMaterial) {
    return (
      <View style={styles.container}>
        <View style={styles.headerArea}>
          <TouchableOpacity 
            style={styles.backBtn} 
            activeOpacity={0.2}
            onPress={() => { setSelectedMaterial(null); if (sound) sound.unloadAsync(); setSound(null); }}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.label} numberOfLines={1}>{selectedMaterial.topic}</Text>
        </View>
        <DigestView 
          material={selectedMaterial} 
          onToggleSound={togglePlayback} 
          isPlaying={playbackStatus?.isPlaying} 
          isAudioLoading={loadingAudio}
          playbackRate={playbackSpeed}
          onSetRate={changeSpeed}
          openLink={openLink}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.label}>📚 Study Materials</Text>
        <TouchableOpacity 
          style={[styles.genBtn, { zIndex: 10 }]} 
          activeOpacity={0.2}
          onPress={() => setShowImportModal(true)}
        >
          <Text style={styles.genBtnText}>📥 Import</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
          <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.cardContainer}>
              <TouchableOpacity 
                style={styles.cardMain} 
                activeOpacity={0.2}
                onPress={() => setSelectedMaterial(item)}
              >
                <Text style={styles.cardTitle}>{item.drive_audio_url ? '🎧' : '📄'} {item.topic}</Text>
                <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.cardDelete, { zIndex: 10 }]} 
                activeOpacity={0.2}
                onPress={() => handleDelete(item.id)} 
                hitSlop={15}
              >
                <Text style={{ fontSize: 20 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No materials yet. Import one to start!</Text>}
        />
      )}

      {showImportModal && (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Import Material</Text>
                <TouchableOpacity onPress={() => setShowImportModal(false)} activeOpacity={0.2}>
                  <Text style={{ fontSize: 24 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.importLabel}>Topic</Text>
                <TextInput style={styles.importInput} placeholder="Topic" value={importTopic} onChangeText={setImportTopic} />
                <Text style={styles.importLabel}>Content</Text>
                <TextInput style={[styles.importInput, { minHeight: 180 }]} multiline placeholder="Paste text here..." value={importContent} onChangeText={setImportContent} />
                <Text style={styles.importLabel}>Audio URL (Optional)</Text>
                <TextInput style={styles.importInput} placeholder="Drive link..." value={importAudioUrl} onChangeText={setImportAudioUrl} />
                <TouchableOpacity 
                  style={[styles.genBtn, { zIndex: 10 }]} 
                  activeOpacity={0.2}
                  onPress={handleImport} 
                  disabled={importing}
                >
                  <Text style={styles.genBtnText}>{importing ? '⏳ Importing...' : '📥 Save Material'}</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  headerArea: { padding: 20, paddingTop: 60, backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...THEME.typography.h2, color: THEME.colors.primary },
  genBtn: { backgroundColor: THEME.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: THEME.borderRadius.medium },
  genBtnText: { color: '#fff', fontWeight: 'bold' },
  backBtn: { marginRight: 15 },
  backBtnText: { color: THEME.colors.primary, fontWeight: 'bold' },
  cardContainer: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.borderRadius.large, borderWidth: 1, borderColor: THEME.colors.border, marginBottom: 12, overflow: 'hidden' },
  cardMain: { flex: 1, padding: 16 },
  cardDelete: { width: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff0f0', borderLeftWidth: 1, borderLeftColor: THEME.colors.border },
  cardTitle: { ...THEME.typography.h3, color: THEME.colors.onSurface },
  cardMeta: { fontSize: 12, color: THEME.colors.textMuted },
  empty: { textAlign: 'center', color: THEME.colors.textMuted, marginTop: 40 },
  list: { padding: 20 },
  
  digestScroll: { padding: 20 },
  digestHeader: { marginBottom: 20, borderLeftWidth: 4, borderLeftColor: THEME.colors.primary, paddingLeft: 16 },
  digestPartLabel: { ...THEME.typography.body2, color: THEME.colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  digestPartTitle: { ...THEME.typography.h1, color: THEME.colors.onSurface, marginTop: 4 },
  
  audioControls: { backgroundColor: THEME.colors.surfaceLight, padding: 16, borderRadius: THEME.borderRadius.large, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: THEME.colors.border },
  playBtn: { backgroundColor: THEME.colors.primary, paddingVertical: 14, borderRadius: THEME.borderRadius.medium, alignItems: 'center' },
  linkBtn: { flex: 1, backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.primary, paddingVertical: 14, borderRadius: THEME.borderRadius.medium, alignItems: 'center', justifyContent: 'center' },
  linkBtnText: { color: THEME.colors.primary, fontWeight: 'bold', fontSize: 16 },
  audioBtnActive: { backgroundColor: THEME.colors.secondary },
  playBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  speedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  speedBtn: { flex: 1, paddingVertical: 8, marginHorizontal: 4, borderRadius: THEME.borderRadius.small, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border },
  speedBtnActive: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  speedBtnText: { color: THEME.colors.onSurface, fontWeight: 'bold', fontSize: 12 },
  speedBtnTextActive: { color: '#fff' },

  transcriptBox: { gap: 12 },
  transcriptSentence: { ...THEME.typography.body1, lineHeight: 28, color: THEME.colors.onBackground },
  tappableWord: { paddingVertical: 2 },
  selectedWordHighlight: { backgroundColor: THEME.colors.secondary, borderRadius: 4, color: '#fff' },

  selectionBar: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: THEME.colors.surface, borderRadius: THEME.borderRadius.large, padding: 16, flexDirection: 'row', alignItems: 'center', ...THEME.shadows.large, borderOuterWidth: 1, borderColor: THEME.colors.border },
  selectionBarTitle: { flex: 1, ...THEME.typography.body2, color: THEME.colors.onSurface, fontWeight: 'bold' },
  selectionBarActions: { flexDirection: 'row', gap: 8 },
  selectionBarBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: THEME.borderRadius.small, backgroundColor: THEME.colors.primary },
  selectionBarBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  toastBox: { position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, borderRadius: 20, zIndex: 10 },
  toastText: { color: '#fff', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  modalTitle: { ...THEME.typography.h3 },
  importLabel: { fontWeight: '700', marginBottom: 8, color: THEME.colors.onSurface },
  importInput: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#dee2e6' },
});
