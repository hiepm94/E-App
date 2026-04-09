import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Modal, Animated, Clipboard, Platform
} from 'react-native';
import { Audio } from 'expo-av';
import { API_BASE, apiFetch } from '../api';
import { THEME } from '../theme';

// ── Tier 1: Test Summary Card ──────────────────────────────────────────────
const TestSummaryCard = ({ item, index, materialType, onSelect, handleDelete }) => {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay: index * 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [index]);

  const parts = item.tasks?.[0]?.questions?.parts || [];

  return (
    <Animated.View style={[styles.cardWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => onSelect(item)}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {materialType === 'reading' ? '📄' : '🎧'} {item.material.topic || 'Generated Test'}
            </Text>
            <TouchableOpacity style={styles.deleteBtn} onPress={(e) => { e.stopPropagation?.(); handleDelete(item.material.id); }}>
              <Text style={styles.deleteText}>🗑️</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardMeta}>{parts.length} Part{parts.length !== 1 ? 's' : ''} Available</Text>
            <Text style={styles.cardCta}>Tap to Study ➔</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Word Popup: shows when user taps a word in Digest view ─────────────────
const WordPopup = ({ word, sentence, onAddVocab, onAddParrot, onCopy, onClose }) => (
  <View style={styles.wordPopupOverlay}>
    <TouchableOpacity style={styles.wordPopupDismiss} onPress={onClose} activeOpacity={1} />
    <View style={styles.wordPopup}>
      <Text style={styles.wordPopupWord}>"{word}"</Text>
      <View style={styles.wordPopupActions}>
        <TouchableOpacity style={[styles.wordPopupBtn, { backgroundColor: THEME.colors.primary }]} onPress={() => onAddVocab(word)}>
          <Text style={styles.wordPopupBtnText}>📚 Add Vocab</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.wordPopupBtn, { backgroundColor: THEME.colors.secondary }]} onPress={() => onAddParrot(sentence)}>
          <Text style={styles.wordPopupBtnText}>🦜 Add Parrot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.wordPopupBtn, { backgroundColor: THEME.colors.surfaceLight, borderWidth: 1, borderColor: THEME.colors.border }]} onPress={() => onCopy(word)}>
          <Text style={[styles.wordPopupBtnText, { color: THEME.colors.onSurface }]}>📋 Copy</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

// ── Study View (Transcript Digest): Tier 3 ────────────────────────────────
const DigestView = ({ part, materialType, onToggleSound, isPlaying, isAudioLoading, onStartExercises, playbackRate, onSetRate, openLink }) => {
  const transcript = part.transcript_segment || "";
  const [toast, setToast] = useState(null);
  const [savingVocab, setSavingVocab] = useState(false);
  const [savingParrot, setSavingParrot] = useState(false);
  
  // Selection state: { sIdx: number | null, start: number | null, end: number | null }
  const [selection, setSelection] = useState({ sIdx: null, start: null, end: null });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleWordTap = (sIdx, wIdx) => {
    setSelection(prev => {
      // If tapping a different sentence, start fresh
      if (prev.sIdx !== sIdx) {
        return { sIdx, start: wIdx, end: wIdx };
      }
      // If same sentence, expand range
      const newStart = Math.min(prev.start, wIdx);
      const newEnd = Math.max(prev.end, wIdx);
      return { sIdx, start: newStart, end: newEnd };
    });
  };

  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const getSelectedText = () => {
    if (selection.sIdx === null) return "";
    const sentence = sentences[selection.sIdx];
    const words = sentence.split(/\s+/);
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
    } finally {
      setSavingVocab(false);
    }
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
    } finally {
      setSavingParrot(false);
    }
  };

  const handleCopy = (text) => {
    Clipboard.setString(text);
    // Note: setSelectedWord doesn't exist anymore in this version, using toast only
    showToast('📋 Copied to clipboard!');
  };

  const hasQuestions = part.questions && part.questions.length > 0;
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const res = await apiFetch(`/ielts/material/${materialType}/part/${part.id}/generate`, {
        method: 'POST'
      });
      if (res.status === 'success') {
        onQuestionsGenerated(res.questions);
      } else {
        setError('Failed to generate. Try again.');
      }
    } catch (err) {
      setError('Generation error.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.digestScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.digestHeader}>
          <Text style={styles.digestPartLabel}>{(materialType === 'reading' ? 'Passage ' : 'Section ') + part.part}</Text>
          <Text style={styles.digestPartTitle}>{part.title || 'Untitled'}</Text>
        </View>

        {materialType === 'listening' && (
          <View style={styles.audioControls}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity 
                  style={[styles.playBtn, { flex: 2 }, (isPlaying || isAudioLoading) && styles.audioBtnActive]} 
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
                  onPress={() => openLink(part.drive_audio_url)}
                >
                  <Text style={styles.linkBtnText}>🌐 Link</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.speedRow}>
              <Text style={styles.speedLabel}>Speed:</Text>
              {[0.8, 1.0, 1.2, 1.5].map(rate => (
                <TouchableOpacity 
                  key={rate} 
                  style={[styles.speedBtn, playbackRate === rate && styles.speedBtnActive]}
                  onPress={() => onSetRate(rate)}
                >
                  <Text style={[styles.speedBtnText, playbackRate === rate && styles.speedBtnTextActive]}>{rate}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.digestHintBox}>
          <Text style={styles.digestHint}>💡 Tap words to select a phrase for Vocab or Parrot</Text>
        </View>

        {toast ? <View style={styles.toastBox}><Text style={styles.toastText}>{toast}</Text></View> : null}
        {(savingVocab || savingParrot) && <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginBottom: 8 }} />}

        <View style={styles.transcriptBox}>
          {sentences.map((sentence, sIdx) => {
            const words = sentence.split(/\s+/);
            return (
              <Text key={sIdx} style={styles.transcriptSentence}>
                {words.map((word, wIdx) => {
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
            );
          })}
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Floating Selection Bar */}
      {selection.sIdx !== null && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarTitle} numberOfLines={1}>Selected: "{getSelectedText()}"</Text>
          <View style={styles.selectionBarActions}>
            <TouchableOpacity style={styles.selectionBarBtn} onPress={handleAddVocab} disabled={savingVocab}>
              <Text style={styles.selectionBarBtnText}>{savingVocab ? '...' : '📚 Vocab'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectionBarBtn} onPress={handleAddParrot} disabled={savingParrot}>
              <Text style={styles.selectionBarBtnText}>{savingParrot ? '...' : '🦜 Parrot'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selectionBarBtn, { backgroundColor: '#FF4444' }]} onPress={() => setSelection({ sIdx: null, start: null, end: null })}>
              <Text style={styles.selectionBarBtnText}>❌</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {selection.sIdx === null && (
        <View style={styles.digestFooter}>
          {error ? <Text style={[styles.errorText, { marginBottom: 10 }]}>{error}</Text> : null}
          {!hasQuestions ? (
            <TouchableOpacity 
              style={[styles.startExercisesBtn, { backgroundColor: THEME.colors.secondary }]} 
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              <Text style={styles.startExercisesBtnText}>
                {isGenerating ? '⏳ Generating...' : '✨ Generate Exercises'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.startExercisesBtn} onPress={onStartExercises}>
              <Text style={styles.startExercisesBtnText}>Start Exercises →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// ── Exercise View: Full Interactive Practice Session ───────────────────────
const ExerciseView = ({ part, materialType, onQuestionsGenerated, transcript }) => {
  const questions = part.questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isGraded, setIsGraded] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTranscript, setShowTranscript] = useState(materialType === 'reading');
  const progressAnim = useRef(new Animated.Value(0)).current;

  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const score = Object.values(answers).filter(a => a.correct).length;
  const progress = total > 0 ? (answeredCount / total) * 100 : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? (isGraded ? 1 : answeredCount / total) : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [answeredCount, total, isGraded]);

  const recordAnswer = (idx, value, correct) => {
    if (isGraded) return;
    setAnswers(prev => ({ ...prev, [idx]: { value, correct } }));
  };

  const handleFinish = () => {
    if (answeredCount < total) {
      Alert.alert(
        "Unfinished Answers",
        `You have answered ${answeredCount} out of ${total} questions. Grade anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes, Grade", onPress: () => setIsGraded(true) }
        ]
      );
    } else {
      setIsGraded(true);
    }
  };

  const handleRetry = () => {
    setAnswers({}); setIsGraded(false); setShowSummary(false);
  };

  const isCorrectOption = (q, opt) => {
    if (!q.answer) return false;
    return opt === q.answer || opt.trim().toLowerCase() === q.answer.trim().toLowerCase();
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await apiFetch(`/ielts/material/${materialType}/part/${part.id}/generate`, {
        method: 'POST'
      });
      if (res.status === 'success' && res.questions) {
        onQuestionsGenerated(res.questions);
      } else {
        Alert.alert("Error", "Could not generate questions. Please try again.");
      }
    } catch (err) {
      Alert.alert("Error", "Generation failed. Check your connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (total === 0) {
    return (
      <View style={styles.exerciseEmpty}>
        <Text style={styles.exerciseEmptyText}>🧩 No exercises for this part yet.</Text>
        <Text style={styles.exerciseEmptyHint}>Let our AI create custom IELTS questions for this specific text segment.</Text>
        <TouchableOpacity 
          style={[styles.submitBtn, { marginTop: 24, paddingHorizontal: 32 }]} 
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>✨ Generate AI Exercises</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (showSummary) {
    const pct = Math.round((score / total) * 100);
    const medal = pct >= 80 ? '🥇' : pct >= 60 ? '🥈' : '🥉';
    const barColor = pct >= 80 ? '#27ae60' : pct >= 60 ? '#f39c12' : THEME.colors.error;
    return (
      <ScrollView contentContainerStyle={styles.summaryContainer}>
        <Text style={styles.summaryEmoji}>{medal}</Text>
        <Text style={styles.summaryTitle}>Practice Complete!</Text>
        <Text style={styles.summaryScore}>{score} / {total} correct</Text>
        <View style={styles.summaryBarTrack}>
          <View style={[styles.summaryBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.summaryPct, { color: barColor }]}>{pct}%</Text>

        <Text style={styles.summaryReviewHeader}>Question Review</Text>
        {questions.map((q, i) => {
          const a = answers[i];
          return (
            <View key={i} style={[styles.summaryItem, a?.correct ? styles.summaryItemCorrect : styles.summaryItemWrong]}>
              <Text style={styles.summaryItemNum}>Q{i + 1} {a?.correct ? '✅' : '❌'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryItemQ} numberOfLines={3}>{q.question}</Text>
                {a?.value ? (
                  <Text style={{ fontSize: 13, color: a.correct ? '#27ae60' : THEME.colors.error, marginTop: 4 }}>
                    Your answer: <Text style={{ fontWeight: '700' }}>{a.value}</Text>
                    {!a.correct && q.answer ? `\n✔ Correct: ${q.answer}` : ''}
                  </Text>
                ) : (
                  <Text style={{ color: THEME.colors.textMuted, fontSize: 13 }}>Skipped</Text>
                )}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
          <Text style={styles.retryBtnText}>🔁 Try Again</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {showTranscript && (
        <View style={[styles.readingTranscriptArea, { height: '35%', borderBottomWidth: 1, borderBottomColor: THEME.colors.border }]}>
          <View style={{ padding: 12, backgroundColor: THEME.colors.surfaceLight, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 12, color: THEME.colors.primary }}>PASSAGE TEXT</Text>
            {materialType === 'listening' && (
              <TouchableOpacity onPress={() => setShowTranscript(false)}>
                <Text style={{ color: THEME.colors.textMuted, fontSize: 12 }}>Hide</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
             <Text style={[styles.bodyText, { fontSize: 15 }]}>{transcript || 'No text available.'}</Text>
          </ScrollView>
        </View>
      )}

      {materialType === 'listening' && !showTranscript && (
        <TouchableOpacity 
          style={{ padding: 10, alignItems: 'center', backgroundColor: THEME.colors.surfaceLight }}
          onPress={() => setShowTranscript(true)}
        >
          <Text style={{ color: THEME.colors.primary, fontSize: 12, fontWeight: '700' }}>Show Transcript</Text>
        </TouchableOpacity>
      )}

      <View style={styles.progressBarTrack}>
        <Animated.View style={[styles.progressBarFill, {
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: isGraded ? (score/total >= 0.7 ? '#27ae60' : THEME.colors.primary) : THEME.colors.primary
        }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 }}>
        <Text style={styles.progressLabel}>
          {isGraded ? `FINAL SCORE: ${score}/${total}` : `Answered: ${answeredCount}/${total}`}
        </Text>
        {isGraded && (
          <TouchableOpacity onPress={() => setShowSummary(true)}>
            <Text style={{ color: THEME.colors.secondary, fontWeight: 'bold' }}>View Summary ➔</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.questionContainer} showsVerticalScrollIndicator={false}>
        {questions.map((q, idx) => {
          const myAnswer = answers[idx];
          return (
            <View key={idx} style={{ marginBottom: 40, paddingBottom: 20, borderBottomWidth: idx < total - 1 ? 1 : 0, borderBottomColor: THEME.colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                 <View style={{ backgroundColor: THEME.colors.surfaceLight, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Text style={{ fontWeight: 'bold', color: THEME.colors.primary }}>{idx + 1}</Text>
                 </View>
                 {q.type && (
                  <View style={styles.qTypePill}>
                    <Text style={styles.qTypePillText}>{q.type.replace(/_/g, ' ').toUpperCase()}</Text>
                  </View>
                 )}
              </View>

              <Text style={styles.questionText}>{q.question}</Text>

              {/* ── MCQ Options ── */}
              {q.options && q.options.length > 0 && (
                <View style={styles.optionsWrap}>
                  {q.options.map((opt, i) => {
                    const isPicked = myAnswer?.value === opt;
                    const correctOpt = isCorrectOption(q, opt);
                    const showResult = isGraded;

                    let btnStyle = styles.optBtn;
                    let textColor = THEME.colors.onSurface;
                    if (!showResult && isPicked) { btnStyle = styles.optBtnPending; textColor = '#fff'; }
                    if (showResult && correctOpt) { btnStyle = styles.optBtnCorrect; textColor = '#fff'; }
                    if (showResult && isPicked && !correctOpt) { btnStyle = styles.optBtnWrong; textColor = '#fff'; }

                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.8}
                        disabled={isGraded}
                        onPress={() => {
                           const correct = isCorrectOption(q, opt);
                           recordAnswer(idx, opt, correct);
                        }}
                        style={[styles.optBtn, btnStyle]}
                      >
                        <View style={styles.optInner}>
                          <View style={[styles.optCircle,
                            !showResult && isPicked && { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
                            showResult && correctOpt && { backgroundColor: '#27ae60', borderColor: '#27ae60' },
                            showResult && isPicked && !correctOpt && { backgroundColor: THEME.colors.error, borderColor: THEME.colors.error },
                          ]}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>
                              {showResult && correctOpt ? '✓' : showResult && isPicked && !correctOpt ? '✗' : isPicked ? '●' : ''}
                            </Text>
                          </View>
                          <Text style={[styles.optText, { color: textColor }]}>{opt}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ── Fill-in-the-blank / Short answer ── */}
              {(!q.options || q.options.length === 0) && (
                <View style={styles.fillBlankContainer}>
                  <TextInput
                    style={[
                      styles.fillBlankInput,
                      isGraded && { borderColor: myAnswer?.correct ? '#27ae60' : THEME.colors.error, borderWidth: 2 },
                    ]}
                    placeholder="Type your answer here..."
                    placeholderTextColor={THEME.colors.textMuted}
                    value={myAnswer?.value || ''}
                    editable={!isGraded}
                    onChangeText={(text) => {
                      const correct = q.answer
                        ? text.trim().toLowerCase() === q.answer.trim().toLowerCase()
                        : false;
                      recordAnswer(idx, text, correct);
                    }}
                  />
                  {isGraded && q.answer && (
                    <View style={styles.answerReveal}>
                      <Text style={styles.answerRevealLabel}>✔ Correct answer:</Text>
                      <Text style={styles.answerRevealText}>{q.answer}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Feedback banner */}
              {isGraded && (
                <View style={[styles.feedbackBox, myAnswer?.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
                  <Text style={styles.feedbackText}>
                    {myAnswer?.correct
                      ? '✅ Correct!'
                      : `❌ Incorrect. The answer: ${q.answer || 'check transcript'}`}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer nav */}
      <View style={styles.exerciseFooter}>
        {!isGraded ? (
          <TouchableOpacity
            style={[styles.submitBtn, answeredCount === 0 && { opacity: 0.45 }]}
            onPress={handleFinish}
            disabled={answeredCount === 0}
          >
            <Text style={styles.submitBtnText}>🏁 Finish & Grade All</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleRetry}>
            <Text style={styles.nextBtnText}>🔁 Retry Practice</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── Writing/Speaking Practice View: Tier 4 ──────────────────────────────────
const ProductionPracticeView = ({ part, materialType, onSubmissionSuccess, showAlert }) => {
  const [draft, setDraft] = useState(part.user_submission || part.user_audio_url || '');
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState(part.correction_feedback || null);

  // Recording State
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return Alert.alert('Permission needed', 'Allow microphone access to record speech.');

      const options = {
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 },
        ios: { extension: '.m4a', outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 }
      };

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
      const { recording: newRecording } = await Audio.Recording.createAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, ...options });
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording: ' + err.message);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Cross-platform FormData append
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, 'speech.m4a');
      } else {
        formData.append('file', {
          uri,
          name: 'speech.m4a',
          type: 'audio/m4a',
        });
      }

      const data = await apiFetch('/ielts/speaking/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (data.text) {
        setDraft(prev => prev ? `${prev}\n${data.text}` : data.text);
      }
    } catch (err) {
      Alert.alert('Transcription Error', err.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      const isNewJournal = materialType === 'daily_journal' && !part.db_task_id;
      const endpoint = isNewJournal 
        ? '/ielts/writing/journal/submit'
        : (materialType === 'writing' || materialType === 'daily_journal'
          ? `/ielts/writing/${part.db_task_id || 0}/submit`
          : `/ielts/speaking/${part.db_task_id}/submit`);
      
      const resp = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          type: materialType === 'daily_journal' ? 'daily_journal' : 'ielts_brief',
          brief_content: part.brief_content,
          user_submission: draft.trim()
        }),
      });
      const updatedPart = resp.tasks[0].questions.parts[0];
      setEvaluation(updatedPart.correction_feedback);
      onSubmissionSuccess(updatedPart);
      showAlert('Success', 'AI analysis complete! Review your feedback below.');
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isEvaluated = evaluation && (
    (evaluation.score && evaluation.score !== 'N/A') || 
    (evaluation.feedback && evaluation.feedback.trim().length > 0)
  );
  const handleRetry = () => setEvaluation(null);

  return (
    <ScrollView contentContainerStyle={styles.partDetailView}>
      <View style={styles.section}>
        <Text style={styles.sectionHead}>Prompt / Topic</Text>
        <Text style={styles.bodyText}>{part.brief_content}</Text>
      </View>

      {!isEvaluated ? (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionHead}>Your Response</Text>
            {materialType === 'speaking' && (
              <TouchableOpacity 
                style={[styles.micBtn, isRecording && styles.micBtnActive]} 
                onPressIn={startRecording}
                onPressOut={stopRecording}
                delayLongPress={0}
                activeOpacity={0.6}
              >
                {isRecording && <View style={styles.pulsingIndicator} />}
                <Text style={styles.micBtnText}>{isRecording ? '⏺ RECORDING...' : '🎙️ Hold to Speak'}</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <TextInput
            style={[styles.inputArea, { minHeight: 250 }]}
            placeholderTextColor={THEME.colors.textMuted}
            placeholder={materialType === 'speaking' ? "Speaking Transcript will appear here..." : "Write your essay here..."}
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlignVertical="top"
          />

          {isTranscribing && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
              <ActivityIndicator size="small" color={THEME.colors.secondary} />
              <Text style={{ marginLeft: 8, color: THEME.colors.secondary, fontSize: 13, fontWeight: 'bold' }}>✨ Transcribing Speech...</Text>
            </View>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting || isRecording || isTranscribing}>
            <Text style={styles.submitBtnText}>{submitting ? 'Evaluating...' : '✨ Submit for AI Evaluation'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={styles.scoreHighlightBox}>
            <Text style={styles.scoreLabel}>Estimated Band Score</Text>
            <Text style={styles.scoreValue}>{evaluation.score || 'N/A'}</Text>
          </View>

          {evaluation.enhanced_version && (
            <View style={[styles.section, styles.enhancedSection]}>
              <Text style={[styles.sectionHead, { color: THEME.colors.secondary }]}>✨ AI Enhanced Version (Band 9.0)</Text>
              <Text style={styles.bodyText}>{evaluation.enhanced_version}</Text>
              <TouchableOpacity onPress={() => Clipboard.setString(evaluation.enhanced_version)} style={styles.copyBtnInline}>
                <Text style={styles.copyBtnInlineText}>📋 Copy Enhanced Version</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionHead}>General Feedback</Text>
            <Text style={styles.bodyText}>{evaluation.feedback}</Text>
          </View>

          {evaluation.grammar_tips?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHead}>Grammar & Accuracy</Text>
              {evaluation.grammar_tips.map((t, i) => <Text key={i} style={styles.listItem}>• {t}</Text>)}
            </View>
          )}

          {evaluation.vocab_tips?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHead}>Vocabulary & Lexical Range</Text>
              {evaluation.vocab_tips.map((t, i) => <Text key={i} style={styles.listItem}>• {t}</Text>)}
            </View>
          )}

          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: THEME.colors.secondary, marginTop: 10 }]} onPress={handleRetry}>
            <Text style={styles.submitBtnText}>✍️ REWRITE / TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

// ── Main MaterialScreen ─────────────────────────────────────────────────────
export default function MaterialScreen({ materialType = 'reading', autoStartJournal = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');
  const [manualExercises, setManualExercises] = useState('');
  const [manualAudioUrl, setManualAudioUrl] = useState('');

  // 4-Tier navigation state
  const [selectedTest, setSelectedTest] = useState(null);  // Tier 2
  const [digestPart, setDigestPart] = useState(null);       // Tier 3 (Digest)
  const [exercisePart, setExercisePart] = useState(null);   // Tier 4 (Exercises)
  const [didManualBack, setDidManualBack] = useState(false); // Guard for auto-select loops

  const navigation = useNavigation();

  // Audio state
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [generatingPartId, setGeneratingPartId] = useState(null);

  // Auto-Select Journal Part: Skip Tier 3 for daily journals
  useEffect(() => {
    if (selectedTest?.material?.type === 'daily_journal' && !exercisePart && !didManualBack) {
      const parts = selectedTest.tasks?.[0]?.questions?.parts || [];
      if (parts.length > 0) {
        setExercisePart(parts[0]);
      }
    }
  }, [selectedTest, exercisePart, didManualBack]);

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const setRate = async (rate) => {
    setPlaybackRate(rate);
    if (sound) {
      await sound.setRateAsync(rate, true);
    }
  };

  const stopAudio = useCallback(async () => {
    if (sound) { await sound.unloadAsync(); setSound(null); setIsPlaying(false); }
  }, [sound]);

  const toggleSound = async (url) => {
    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    const targetUrl = url || digestPart?.drive_audio_url;
    if (!targetUrl) {
      Alert.alert('Missing Audio', 'No audio URL found for this section. Please ensure you imported a valid link.');
      return;
    }

    let srcUrl = targetUrl;
    if (targetUrl.includes('drive.google.com')) {
      const fileIdMatch = targetUrl.match(/id=([^&]+)/) || 
                          targetUrl.match(/\/d\/([^/]+)/) ||
                          targetUrl.match(/\/open\?id=([^&]+)/);
      
      if (fileIdMatch?.[1]) {
        srcUrl = `https://docs.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      } else {
        Alert.alert('Invalid Link', 'The Google Drive link format is not recognized. Please use a standard sharing link.');
        return;
      }
    }

    setIsAudioLoading(true);
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
      const { sound: ns } = await Audio.Sound.createAsync(
        { uri: srcUrl },
        { rate: playbackRate, shouldCorrectPitch: true, shouldPlay: true },
        (status) => {
          if (status.didJustFinish) setIsPlaying(false);
        }
      );
      setSound(ns);
      setIsPlaying(true);
    } catch (e) {
      Alert.alert('Playback Error', 'Could not load audio. Check if the Drive file is public.\n\nDetail: ' + e.message);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = `/ielts/material?type=${materialType}`;
      if (materialType === 'writing') endpoint = '/ielts/writing';
      if (materialType === 'speaking') endpoint = '/ielts/speaking';
      
      const data = await apiFetch(endpoint);
      setItems(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [materialType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  
  useEffect(() => {
    if (autoStartJournal && items.length >= 0) {
      handleNewJournal();
    }
  }, [autoStartJournal]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      let endpoint = `/ielts/material/generate?type=${materialType}`;
      if (materialType === 'writing') endpoint = '/ielts/writing/generate';
      if (materialType === 'speaking') endpoint = '/ielts/speaking/generate';
      
      await apiFetch(endpoint, { method: 'POST' });
      fetchItems();
    } catch (err) { setError(err.message); }
    finally { setGenerating(false); }
  };

  const handleNewJournal = async () => {
    setDidManualBack(false);
    const newJournal = {
      material: { id: Date.now(), topic: 'New Journal Entry', type: 'daily_journal' },
      tasks: [{ questions: { parts: [{ part: 1, brief_content: 'Write about your day...', db_task_id: null }] } }]
    };
    setExercisePart(newJournal.tasks[0].questions.parts[0]);
    setSelectedTest(newJournal);
  };

  const handleGeneratePartQuestions = async (part) => {
    setGeneratingPartId(part.id);
    try {
      const res = await apiFetch(`/ielts/material/${materialType}/part/${part.id}/generate`, {
        method: 'POST'
      });
      if (res.status === 'success') {
        // Update local state
        setSelectedTest(prev => {
          const newTest = { ...prev };
          const partsRef = newTest.tasks[0].questions.parts;
          const idx = partsRef.findIndex(p => p.id === part.id);
          if (idx !== -1) {
            partsRef[idx].questions = res.questions;
          }
          return newTest;
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Generation failed: ' + err.message);
    } finally {
      setGeneratingPartId(null);
    }
  };

  // ── Helpers ──
  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const openLink = (url) => {
    if (!url) return showAlert('Error', 'No link found');
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(err => showAlert('Error', 'Could not open URL'));
    }
  };

  const handleImport = async () => {
    console.warn("TRACE: handleImport called (MaterialScreen)", { transcriptLen: manualTranscript.length });

    if (!manualTranscript.trim()) return showAlert('Error', 'Transcript is required');
    
    setImporting(true);
    try {
      await apiFetch('/ielts/material', {
        method: 'POST',
        body: JSON.stringify({ 
          type: materialType, 
          raw_transcript: manualTranscript.trim(), 
          raw_text: manualExercises.trim(),
          drive_audio_url: manualAudioUrl.trim()
        }),
      });
      setShowImportModal(false);
      setManualTranscript(''); 
      setManualExercises(''); 
      setManualAudioUrl('');
      fetchItems();
    } catch (err) { 
        console.warn("TRACE: handleImport FAILED (MaterialScreen)", err.message);
        showAlert('Error', err.message); 
    }
    finally { setImporting(false); }
  };

  const handleDelete = async (id) => {
    try {
      let endpoint = `/ielts/material/${id}?type=${materialType}`;
      if (materialType === 'writing') endpoint = `/ielts/writing/${id}`;
      if (materialType === 'speaking') endpoint = `/ielts/speaking/${id}`;
      
      await apiFetch(endpoint, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.material.id !== id));
      if (selectedTest?.material?.id === id) { setSelectedTest(null); setDigestPart(null); setExercisePart(null); }
    } catch (err) { showAlert('Error', err.message); }
  };

  const handleBack = async () => {
    if (exercisePart) { 
      if (selectedTest?.material?.type === 'daily_journal') {
        setDidManualBack(true);
      }
      setExercisePart(null); 
    }
    else if (digestPart) { await stopAudio(); setDigestPart(null); }
    else { 
      setSelectedTest(null); 
      setDidManualBack(false);
      // If we were in auto-start mode (direct journal entry), exit the screen entirely
      if (autoStartJournal) {
        navigation.goBack();
      }
    }
  };

  const navTitle = exercisePart
    ? `Practice — Part ${exercisePart.part}`
    : digestPart
    ? `📖 Study — Part ${digestPart.part}`
    : selectedTest?.material?.topic || 'Test Breakdown';

  const parts = selectedTest?.tasks?.[0]?.questions?.parts || [];
  
  const skillInfo = {
    reading: { icon: '📄', label: 'Reading' },
    listening: { icon: '🎧', label: 'Listening' },
    writing: { icon: '✍️', label: 'Writing' },
    speaking: { icon: '🗣️', label: 'Speaking' }
  }[materialType] || { icon: '📚', label: materialType };

  return (
    <View style={styles.container}>
      <View style={styles.glowA} />
      <View style={styles.glowB} />

      <View style={styles.headerArea}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.label}>{skillInfo.icon} IELTS {skillInfo.label}</Text>
          {materialType === 'writing' && (
            <TouchableOpacity 
                style={styles.newJournalBtn} 
                activeOpacity={0.2}
                onPress={handleNewJournal}
            >
              <Text style={styles.newJournalBtnText}>📝 New Journal</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.btnRow}>
          {(materialType === 'reading' || materialType === 'listening') && (
            <TouchableOpacity 
                style={styles.importBtn} 
                activeOpacity={0.2}
                onPress={() => setShowImportModal(true)}
            >
              <Text style={styles.importBtnText}>📥 Import</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.genBtn} 
            activeOpacity={0.2}
            onPress={handleGenerate} 
            disabled={generating}
          >
            <Text style={styles.genBtnText}>{generating ? '⏳ Working...' : '✨ Generate'}</Text>
          </TouchableOpacity>
        </View>
        {error && <Text style={styles.errorText}>⚠ {error}</Text>}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.material.id.toString()}
          renderItem={({ item, index }) => (
            <TestSummaryCard item={item} index={index} materialType={materialType}
              onSelect={setSelectedTest} 
              handleDelete={handleDelete} 
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No materials yet. Tap Generate to start!</Text>}
        />
      )}

      <Modal
        visible={!!selectedTest}
        animationType="slide"
        onRequestClose={handleBack}
      >
        <View style={styles.modalScreen}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle} numberOfLines={1}>{navTitle}</Text>
          </View>

          {!digestPart && !exercisePart && (
            <ScrollView contentContainerStyle={styles.partsList}>
              <Text style={styles.breakdownHeader}>Choose a Part to Study</Text>
              {parts.map((p, idx) => {
                const qCount = p.questions?.length || 0;
                return (
                  <View key={idx} style={styles.partItemCardContainer}>
                    <TouchableOpacity 
                      style={styles.partItemCardMain} 
                      onPress={() => {
                        if (materialType === 'reading' || materialType === 'listening') {
                          setDigestPart(p);
                        } else {
                          setExercisePart(p);
                        }
                      }}
                    >
                      <View style={styles.partItemLeft}>
                        <Text style={styles.partItemNum}>Part {p.part}</Text>
                        <Text style={styles.partItemTitle}>{p.title || 'Section'}</Text>
                        <Text style={[styles.partItemMeta, qCount > 0 && { color: '#27ae60', fontWeight: 'bold' }]}>
                          {qCount > 0 ? `✅ ${qCount} Questions Ready` : '⚪ No Questions'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {qCount === 0 && (
                      <TouchableOpacity 
                        style={styles.partItemGenBtn} 
                        onPress={() => handleGeneratePartQuestions(p)}
                        disabled={generatingPartId === p.id}
                      >
                        {generatingPartId === p.id ? (
                          <ActivityIndicator size="small" color={THEME.colors.primary} />
                        ) : (
                          <Text style={styles.partItemGenBtnText}>✨ Gen</Text>
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => p.part && (materialType === 'reading' || materialType === 'listening' ? setDigestPart(p) : setExercisePart(p))}>
                      <Text style={styles.partItemArrow}>→</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}

           {digestPart && !exercisePart && (
            <DigestView 
              part={digestPart} 
              materialType={materialType} 
              onToggleSound={toggleSound}
              isPlaying={isPlaying}
              isAudioLoading={isAudioLoading}
              playbackRate={playbackRate}
              onSetRate={setRate}
              onStartExercises={() => setExercisePart(digestPart)}
              openLink={openLink}
              onQuestionsGenerated={(newQuestions) => {
                // Update local part
                const updatedPart = { ...digestPart, questions: newQuestions };
                setDigestPart(updatedPart);
                
                // Persist back to the test object
                setSelectedTest(prev => {
                  const newTest = { ...prev };
                  const parts = newTest.tasks[0].questions.parts;
                  const idx = parts.findIndex(p => p.id === digestPart.id);
                  if (idx !== -1) {
                    parts[idx].questions = newQuestions;
                  }
                  return newTest;
                });
              }}
            />
          )}

          {exercisePart && (
            materialType === 'reading' || materialType === 'listening' ? (
              <ExerciseView 
                part={exercisePart} 
                materialType={materialType}
                transcript={exercisePart.content || exercisePart.transcript_segment}
                onQuestionsGenerated={(newQuestions) => {
                  // Update the part in local state to avoid re-fetch
                  const updatedPart = { ...exercisePart, questions: newQuestions };
                  setExercisePart(updatedPart);
                  
                  // Also sync back to the full selectedTest object so it persists
                  setSelectedTest(prev => {
                    const newTest = { ...prev };
                    const parts = newTest.tasks[0].questions.parts;
                    const idx = parts.findIndex(p => p.id === exercisePart.id);
                    if (idx !== -1) {
                      parts[idx].questions = newQuestions;
                    }
                    return newTest;
                  });
                }}
              />
            ) : (
              <ProductionPracticeView 
                part={exercisePart} 
                materialType={selectedTest?.material?.type || materialType} 
                onSubmissionSuccess={() => {
                  fetchItems();
                }}
                showAlert={showAlert}
              />
            )
          )}
        </View>
      </Modal>

      {/* Import Modal */}
      {showImportModal && (
        <Modal visible={true} animationType="slide" transparent={false}>
          <View style={styles.importScreen}>
            <View style={styles.importNavBar}>
              <TouchableOpacity onPress={() => setShowImportModal(false)} style={styles.backBtn} activeOpacity={0.2}>
                <Text style={styles.backBtnText}>✕ Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.navTitle}>Import Transcript</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <Text style={styles.importLabel}>Transcript</Text>
              <TextInput
                style={styles.importInput}
                multiline
                placeholder="Paste text here..."
                placeholderTextColor={THEME.colors.textMuted}
                value={manualTranscript}
                onChangeText={setManualTranscript}
              />
              {materialType === 'listening' && (
                <>
                  <Text style={styles.importLabel}>Audio URL (Google Drive)</Text>
                  <TextInput
                    style={[styles.importInput, { minHeight: 40 }]}
                    placeholder="Paste Drive link (e.g. drive.google.com/file/d/...) or direct m4a/mp3 URL..."
                    placeholderTextColor={THEME.colors.textMuted}
                    value={manualAudioUrl}
                    onChangeText={setManualAudioUrl}
                  />
                </>
              )}
              <Text style={styles.importLabel}>Optional: Questions</Text>
              <TextInput
                style={styles.importInput}
                multiline
                placeholder="Paste questions here (optional)..."
                placeholderTextColor={THEME.colors.textMuted}
                value={manualExercises}
                onChangeText={setManualExercises}
              />
              <TouchableOpacity 
                style={styles.genBtn} 
                activeOpacity={0.2}
                onPress={handleImport} 
                disabled={importing}
              >
                <Text style={styles.genBtnText}>{importing ? '⏳ Importing...' : '📥 Process Material'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  glowA: { position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.colors.primary, opacity: 0.05 },
  glowB: { position: 'absolute', bottom: -100, right: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.colors.secondary, opacity: 0.05 },
  headerArea: { padding: 20, paddingTop: 60, backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  label: { ...THEME.typography.h1, color: THEME.colors.primaryVariant, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 12 },
  importBtn: { flex: 1, backgroundColor: THEME.colors.surfaceLight, paddingVertical: 12, borderRadius: THEME.borderRadius.medium, alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border },
  importBtnText: { ...THEME.typography.button, color: THEME.colors.onSurface },
  genBtn: { flex: 1, backgroundColor: THEME.colors.primary, paddingVertical: 12, borderRadius: THEME.borderRadius.medium, alignItems: 'center', ...THEME.shadows.small },
  genBtnText: { ...THEME.typography.button, color: '#fff' },
  errorText: { color: THEME.colors.error, marginTop: 12, textAlign: 'center' },
  list: { padding: 20, gap: 16, paddingBottom: 100 },
  empty: { textAlign: 'center', color: THEME.colors.textMuted, marginTop: 60, fontSize: 16 },

  cardWrapper: { borderRadius: THEME.borderRadius.large, ...THEME.shadows.medium },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.borderRadius.large, borderWidth: 1, borderColor: THEME.colors.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: THEME.colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  cardTitle: { ...THEME.typography.h3, color: THEME.colors.onSurface, flex: 1 },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  cardBody: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { ...THEME.typography.body2, color: THEME.colors.textMuted },
  cardCta: { color: THEME.colors.primary, fontWeight: 'bold' },

  modalScreen: { flex: 1, backgroundColor: THEME.colors.background },
  navBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  backBtn: { marginRight: 16, padding: 8, backgroundColor: THEME.colors.surfaceLight, borderRadius: 8 },
  backBtnText: { color: THEME.colors.primary, fontWeight: '700' },
  navTitle: { ...THEME.typography.h2, flex: 1, color: THEME.colors.onSurface },

  partsList: { padding: 20, gap: 16, paddingBottom: 80 },
  breakdownHeader: { ...THEME.typography.h1, color: THEME.colors.primaryVariant, marginBottom: 4 },
  breakdownSub: { ...THEME.typography.body2, color: THEME.colors.textMuted, marginBottom: 16 },
  partItemCardContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.surface, borderRadius: THEME.borderRadius.large, borderWidth: 1, borderColor: THEME.colors.border, ...THEME.shadows.small, paddingRight: 12 },
  partItemCardMain: { flex: 1, padding: 20 },
  partItemLeft: { flex: 1 },
  partItemNum: { color: THEME.colors.primary, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  partItemTitle: { ...THEME.typography.h2, color: THEME.colors.onSurface, marginBottom: 4 },
  partItemMeta: { ...THEME.typography.body2, color: THEME.colors.textMuted },
  partItemArrow: { fontSize: 20, marginLeft: 8 },
  partItemGenBtn: { backgroundColor: THEME.colors.surfaceLight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, marginRight: 8 },
  partItemGenBtnText: { fontSize: 12, fontWeight: 'bold', color: THEME.colors.primary },

  digestScroll: { padding: 20, paddingBottom: 40 },
  digestHeader: { marginBottom: 20 },
  digestPartLabel: { color: THEME.colors.primary, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  digestPartTitle: { ...THEME.typography.h1, color: THEME.colors.primaryVariant },
  audioBtn: { backgroundColor: THEME.colors.primary, padding: 16, borderRadius: THEME.borderRadius.medium, alignItems: 'center', marginBottom: 16, ...THEME.shadows.medium },
  audioBtnActive: { backgroundColor: THEME.colors.secondary },
  audioBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  digestHintBox: { backgroundColor: THEME.colors.surfaceLight, padding: 12, borderRadius: THEME.borderRadius.medium, marginBottom: 16, borderWidth: 1, borderColor: THEME.colors.border },
  digestHint: { ...THEME.typography.body2, color: THEME.colors.textMuted, textAlign: 'center' },
  toastBox: { backgroundColor: THEME.colors.primaryVariant, padding: 12, borderRadius: 12, marginBottom: 12 },
  toastText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  transcriptBox: { backgroundColor: THEME.colors.surface, padding: 20, borderRadius: THEME.borderRadius.large, borderWidth: 1, borderColor: THEME.colors.border, ...THEME.shadows.small },
  transcriptSentence: { marginBottom: 16, flexWrap: 'wrap', flexDirection: 'row' },
  tappableWord: { ...THEME.typography.body1, lineHeight: 28, color: THEME.colors.onBackground },
  noTranscript: { color: THEME.colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  digestFooter: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32, backgroundColor: THEME.colors.surface, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  startExercisesBtn: { backgroundColor: THEME.colors.primary, paddingVertical: 18, borderRadius: THEME.borderRadius.large, alignItems: 'center', ...THEME.shadows.medium },
  startExercisesBtnText: { ...THEME.typography.button, color: '#fff', fontSize: 18 },

  wordPopupOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 999 },
  wordPopupDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  wordPopup: { backgroundColor: THEME.colors.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: THEME.colors.border, ...THEME.shadows.antigravity },
  wordPopupWord: { ...THEME.typography.h2, color: THEME.colors.primaryVariant, marginBottom: 16, textAlign: 'center' },
  wordPopupActions: { flexDirection: 'row', gap: 10 },
  wordPopupBtn: { flex: 1, paddingVertical: 14, borderRadius: THEME.borderRadius.medium, alignItems: 'center' },
  wordPopupBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  progressBarTrack: { height: 6, backgroundColor: THEME.colors.surfaceLight, marginHorizontal: 0 },
  progressBarFill: { height: 6, backgroundColor: THEME.colors.primary, borderRadius: 3 },
  progressLabel: { textAlign: 'center', ...THEME.typography.body2, color: THEME.colors.textMuted, paddingVertical: 10, paddingHorizontal: 16 },
  questionContainer: { padding: 20, paddingBottom: 40 },
  qTypePill: { backgroundColor: THEME.colors.primaryVariant, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 14 },
  qTypePillText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  questionText: { ...THEME.typography.h2, color: THEME.colors.onBackground, lineHeight: 30, marginBottom: 24 },
  optionsWrap: { gap: 12 },
  optBtn: { borderWidth: 1.5, borderColor: THEME.colors.border, borderRadius: THEME.borderRadius.medium, padding: 16, backgroundColor: THEME.colors.surface },
  optBtnPending: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  optBtnCorrect: { backgroundColor: '#27ae60', borderColor: '#27ae60' },
  optBtnWrong: { backgroundColor: THEME.colors.error, borderColor: THEME.colors.error },
  optInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  optText: { ...THEME.typography.body1, flex: 1 },
  fillBlankContainer: { gap: 12 },
  fillBlankInput: { borderWidth: 1.5, borderColor: THEME.colors.primary, borderRadius: THEME.borderRadius.medium, color: THEME.colors.onBackground, fontSize: 16, padding: 14, backgroundColor: THEME.colors.surface },
  answerReveal: { backgroundColor: 'rgba(39,174,96,0.1)', borderRadius: THEME.borderRadius.medium, padding: 14, borderWidth: 1, borderColor: '#27ae60' },
  answerRevealLabel: { color: '#27ae60', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  answerRevealText: { color: '#27ae60', fontWeight: '700', fontSize: 16 },
  feedbackBox: { marginTop: 16, padding: 16, borderRadius: THEME.borderRadius.medium, borderWidth: 1 },
  feedbackCorrect: { backgroundColor: 'rgba(39,174,96,0.1)', borderColor: '#27ae60' },
  feedbackWrong: { backgroundColor: 'rgba(231,76,60,0.1)', borderColor: THEME.colors.error },
  feedbackText: { fontWeight: '700', fontSize: 15 },
  exerciseFooter: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32, backgroundColor: THEME.colors.surface, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  navExBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: THEME.borderRadius.medium, backgroundColor: THEME.colors.surfaceLight, borderWidth: 1, borderColor: THEME.colors.border },
  navExBtnText: { fontWeight: '700', color: THEME.colors.onSurface },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: THEME.borderRadius.medium, alignItems: 'center', backgroundColor: THEME.colors.primary, ...THEME.shadows.medium },
  submitBtnText: { ...THEME.typography.button, color: '#fff' },
  nextBtn: { flex: 1, paddingVertical: 14, borderRadius: THEME.borderRadius.medium, alignItems: 'center', backgroundColor: THEME.colors.secondary, ...THEME.shadows.medium },
  nextBtnText: { ...THEME.typography.button, color: '#fff' },
  exerciseEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  exerciseEmptyText: { ...THEME.typography.h2, textAlign: 'center', color: THEME.colors.textMuted, marginBottom: 8 },
  exerciseEmptyHint: { ...THEME.typography.body2, textAlign: 'center', color: THEME.colors.textMuted },

  summaryContainer: { padding: 24, paddingBottom: 80, alignItems: 'center' },
  summaryEmoji: { fontSize: 64, marginBottom: 16, marginTop: 20 },
  summaryTitle: { ...THEME.typography.h1, color: THEME.colors.primaryVariant, marginBottom: 8 },
  summaryScore: { ...THEME.typography.h2, color: THEME.colors.onBackground, marginBottom: 12 },
  summaryBarTrack: { width: '100%', height: 12, backgroundColor: THEME.colors.surfaceLight, borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
  summaryBarFill: { height: 12, borderRadius: 6 },
  summaryPct: { fontSize: 32, fontWeight: '900', marginBottom: 32 },
  summaryReviewHeader: { ...THEME.typography.h2, color: THEME.colors.primaryVariant, alignSelf: 'flex-start', marginBottom: 16 },
  summaryItem: { width: '100%', flexDirection: 'row', gap: 12, padding: 14, borderRadius: THEME.borderRadius.medium, marginBottom: 12, borderWidth: 1 },
  summaryItemCorrect: { backgroundColor: 'rgba(39,174,96,0.08)', borderColor: '#27ae60' },
  summaryItemWrong: { backgroundColor: 'rgba(231,76,60,0.08)', borderColor: THEME.colors.error },
  summaryItemNum: { fontWeight: '900', fontSize: 14, color: THEME.colors.onSurface, marginTop: 2 },
  summaryItemQ: { ...THEME.typography.body1, color: THEME.colors.onSurface, lineHeight: 22 },
  retryBtn: { marginTop: 8, backgroundColor: THEME.colors.primary, paddingVertical: 16, paddingHorizontal: 48, borderRadius: THEME.borderRadius.large, ...THEME.shadows.medium },
  retryBtnText: { ...THEME.typography.button, color: '#fff', fontSize: 17 },

  // Production View Styles
  section: { marginTop: 16, padding: 20, backgroundColor: THEME.colors.surface, borderRadius: THEME.borderRadius.large, borderWidth: 1, borderColor: THEME.colors.border, ...THEME.shadows.small },
  sectionHead: { ...THEME.typography.h3, color: THEME.colors.secondary, marginBottom: 12 },
  bodyText: { ...THEME.typography.body1, lineHeight: 26, color: THEME.colors.onSurface },
  inputArea: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.borderRadius.medium, padding: 16, color: THEME.colors.onBackground, backgroundColor: THEME.colors.background, fontSize: 16, marginTop: 10, marginBottom: 16 },
  scoreHighlightBox: { backgroundColor: THEME.colors.primary, padding: 24, borderRadius: THEME.borderRadius.large, alignItems: 'center', marginTop: 16, ...THEME.shadows.medium },
  scoreLabel: { color: '#fff', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  scoreValue: { color: '#fff', fontSize: 52, fontWeight: '900', marginTop: 4 },
  listItem: { ...THEME.typography.body1, color: THEME.colors.onSurface, marginBottom: 8, marginLeft: 8 },

  // Import screen
  importScreen: { flex: 1, backgroundColor: THEME.colors.background },
  importNavBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  importLabel: { ...THEME.typography.h3, color: THEME.colors.onSurface, marginTop: 10 },
  importInput: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.borderRadius.medium, padding: 12, backgroundColor: THEME.colors.surface, color: THEME.colors.onSurface, minHeight: 120, textAlignVertical: 'top' },
  micBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: THEME.colors.surfaceLight, borderWidth: 1, borderColor: THEME.colors.secondary },
  micBtnActive: { backgroundColor: THEME.colors.error, borderColor: THEME.colors.error },
  micBtnText: { color: THEME.colors.secondary, fontWeight: '700', fontSize: 13 },
  selectedWordHighlight: { backgroundColor: THEME.colors.secondary + '44', borderRadius: 4 },
  selectionBar: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: THEME.colors.surface, padding: 16, borderRadius: 20, ...THEME.shadows.medium, borderWidth: 1, borderColor: THEME.colors.border, zIndex: 1000 },
  selectionBarTitle: { fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 12, textAlign: 'center', fontStyle: 'italic' },
  selectionBarActions: { flexDirection: 'row', gap: 8 },
  selectionBarBtn: { flex: 1, backgroundColor: THEME.colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  selectionBarBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pulsingIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 8 },

  // New Enhancement Styles
  audioControls: { marginTop: 8, marginBottom: 16, backgroundColor: THEME.colors.surfaceLight, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: THEME.colors.border },
  playBtn: { backgroundColor: THEME.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  linkBtn: { flex: 1, backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkBtnText: { color: THEME.colors.primary, fontWeight: 'bold', fontSize: 16 },
  playBtnText: { color: '#fff', fontWeight: 'bold' },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  speedLabel: { fontSize: 13, color: THEME.colors.textMuted, marginRight: 4, fontWeight: '700' },
  speedBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: THEME.colors.background, borderWidth: 1, borderColor: THEME.colors.border },
  speedBtnActive: { backgroundColor: THEME.colors.secondary, borderColor: THEME.colors.secondary },
  speedBtnText: { fontSize: 12, color: THEME.colors.onSurface, fontWeight: '600' },
  speedBtnTextActive: { color: '#fff' },
  enhancedSection: { borderColor: THEME.colors.secondary, borderWidth: 1.5, borderStyle: 'dashed' },
  copyBtnInline: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: THEME.colors.surfaceLight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: THEME.colors.secondary },
  copyBtnInlineText: { fontSize: 13, color: THEME.colors.secondary, fontWeight: 'bold' },
  newJournalBtn: { backgroundColor: THEME.colors.surfaceLight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: THEME.colors.secondary },
  newJournalBtnText: { fontSize: 13, color: THEME.colors.secondary, fontWeight: 'bold' },
  readingTranscriptArea: { backgroundColor: THEME.colors.background },
});
