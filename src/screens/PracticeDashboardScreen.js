import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { THEME } from '../theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 56) / 2;

export default function PracticeDashboardScreen({ navigation }) {
  const featuredSkill = { 
    title: 'Study Hub', 
    desc: 'Reading & Listening practice tests with context-aware AI question generation.', 
    icon: '📚', 
    color: THEME.colors.primary, 
    screen: 'StudyHub' 
  };
  
  const subSkills = [
    { title: 'Writing', desc: 'Essay analysis & band scoring.', icon: '✍️', color: THEME.colors.secondary, screen: 'WritingDetail' },
    { title: 'Speaking', desc: 'Transcription & speech feedback.', icon: '🗣️', color: '#FF5252', screen: 'SpeakingDetail' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Practice Center</Text>
      <Text style={styles.subtitle}>Prepare for your IELTS Academic journey</Text>

      {/* Featured Card */}
      <TouchableOpacity 
        style={styles.featuredCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate(featuredSkill.screen)}
      >
        <View style={[styles.featuredIconContainer, { backgroundColor: featuredSkill.color }]}>
          <Text style={styles.featuredIcon}>{featuredSkill.icon}</Text>
        </View>
        <View style={styles.featuredInfo}>
          <Text style={styles.featuredTitle}>{featuredSkill.title}</Text>
          <Text style={styles.featuredDesc}>{featuredSkill.desc}</Text>
          <View style={styles.pillContainer}>
             <View style={styles.pill}><Text style={styles.pillText}>READING</Text></View>
             <View style={styles.pill}><Text style={styles.pillText}>LISTENING</Text></View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.grid}>
        {subSkills.map((skill) => (
          <TouchableOpacity 
            key={skill.title}
            style={styles.skillCard} 
            activeOpacity={0.9}
            onPress={() => navigation.navigate(skill.screen)}
          >
            <View style={[styles.iconCircle, { backgroundColor: skill.color }]}>
              <Text style={styles.skillIcon}>{skill.icon}</Text>
            </View>
            <Text style={styles.skillTitle}>{skill.title}</Text>
            <Text style={styles.skillDesc} numberOfLines={2}>{skill.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeader}>Daily Habit</Text>
      <TouchableOpacity 
        style={styles.journalCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('JournalDetail')}
      >
        <View style={styles.journalIconContainer}>
          <Text style={styles.journalIcon}>📓</Text>
        </View>
        <View style={styles.journalInfo}>
          <Text style={styles.journalTitle}>Daily Reflection</Text>
          <Text style={styles.journalDesc}>Practice free writing & receive instant AI grammar feedback.</Text>
        </View>
        <Text style={styles.journalArrow}>➔</Text>
      </TouchableOpacity>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  content: { padding: 20, paddingTop: 60 },
  title: { ...THEME.typography.h1, color: THEME.colors.onBackground, marginBottom: 4 },
  subtitle: { ...THEME.typography.body1, color: THEME.colors.textMuted, marginBottom: 32 },
  sectionHeader: { ...THEME.typography.h3, color: THEME.colors.onBackground, marginBottom: 16, marginTop: 12, opacity: 0.8 },
  
  featuredCard: {
    backgroundColor: THEME.colors.surface,
    padding: 24,
    borderRadius: THEME.borderRadius.large,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    ...THEME.shadows.medium,
  },
  featuredIconContainer: {
    width: 80,
    height: 80,
    borderRadius: THEME.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.small,
  },
  featuredIcon: { fontSize: 40 },
  featuredInfo: { flex: 1, marginLeft: 20 },
  featuredTitle: { ...THEME.typography.h2, color: THEME.colors.primaryVariant },
  featuredDesc: { ...THEME.typography.body2, color: THEME.colors.onSurface, marginTop: 4, lineHeight: 18 },
  pillContainer: { flexDirection: 'row', gap: 6, marginTop: 10 },
  pill: { backgroundColor: THEME.colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: THEME.colors.secondary },
  pillText: { fontSize: 9, fontWeight: '900', color: THEME.colors.primaryVariant, letterSpacing: 0.5 },

  grid: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  skillCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    padding: 20,
    borderRadius: THEME.borderRadius.large,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.small,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: THEME.borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...THEME.shadows.small,
  },
  skillIcon: { fontSize: 24 },
  skillTitle: { ...THEME.typography.h3, color: THEME.colors.onSurface, marginBottom: 4 },
  skillDesc: { ...THEME.typography.caption, color: THEME.colors.textMuted, lineHeight: 16 },
  
  journalCard: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.large,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...THEME.shadows.antigravity,
  },
  journalIconContainer: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: THEME.borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  journalIcon: { fontSize: 28 },
  journalInfo: { flex: 1, marginLeft: 16 },
  journalTitle: { ...THEME.typography.h3, color: '#fff' },
  journalDesc: { ...THEME.typography.body2, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  journalArrow: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
});
