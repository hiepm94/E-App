import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { auth } from '../api';
import { THEME } from '../theme';

export default function LoginScreen({ navigation, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      await auth.login(email, password);
      onLogin(); // Callback to App.js to refresh auth state
    } catch (err) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your IELTS journey</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. hello@parrot.ai"
            placeholderTextColor={THEME.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={THEME.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>Don't have an account? <Text style={{color: THEME.colors.primary, fontWeight: '700'}}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: THEME.colors.surface, padding: 32, borderRadius: THEME.borderRadius.large,
    ...THEME.shadows.medium, borderWidth: 1, borderColor: THEME.colors.border
  },
  title: { ...THEME.typography.h1, color: THEME.colors.primary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...THEME.typography.body2, textAlign: 'center', marginBottom: 32 },
  inputGroup: { marginBottom: 20 },
  label: { ...THEME.typography.body2, fontWeight: '700', color: THEME.colors.onSurface, marginBottom: 8 },
  input: {
    backgroundColor: THEME.colors.background, borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.medium, padding: 16, color: THEME.colors.onBackground,
    ...THEME.typography.body1
  },
  btn: {
    backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.medium,
    padding: 18, alignItems: 'center', marginTop: 10, ...THEME.shadows.small
  },
  btnText: { ...THEME.typography.button, color: '#fff' },
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { ...THEME.typography.body2 },
});
