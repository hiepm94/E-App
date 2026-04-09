import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { THEME } from '../theme';

export default function HubDashboardScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Knowledge Hub</Text>
      <Text style={styles.subtitle}>Build your lexical resource and explore natural English expressions.</Text>

      <TouchableOpacity 
        style={styles.card} 
        onPress={() => navigation.navigate('VocabDetail')}
      >
        <View style={[styles.iconContainer, { backgroundColor: THEME.colors.primary }]}>
          <Text style={styles.icon}>📚</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Vocab</Text>
          <Text style={styles.cardDesc}>Master academic and high-level words with collocations and media.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.card} 
        onPress={() => navigation.navigate('ParrotDetail')}
      >
        <View style={[styles.iconContainer, { backgroundColor: THEME.colors.secondary }]}>
          <Text style={styles.icon}>🦜</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Parrot</Text>
          <Text style={styles.cardDesc}>Analyze idioms, grammar patterns, and conversation snippets for natural usage.</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  content: { padding: 20 },
  title: { ...THEME.typography.h1, color: THEME.colors.onBackground, marginBottom: 8 },
  subtitle: { ...THEME.typography.body1, color: THEME.colors.textMuted, marginBottom: 24 },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.large,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...THEME.shadows.medium,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: THEME.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: { fontSize: 30 },
  cardInfo: { flex: 1 },
  cardTitle: { ...THEME.typography.h2, color: THEME.colors.onSurface, marginBottom: 4 },
  cardDesc: { ...THEME.typography.body2, color: THEME.colors.textMuted, lineHeight: 20 },
});
