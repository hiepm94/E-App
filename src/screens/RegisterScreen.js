import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { auth } from '../api';
import { THEME } from '../theme';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await auth.register(email, password);
      Alert.alert('Success', 'Account created! Please login.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Join Us</Text>
        <Text style={styles.subtitle}>Create an account to start studying</Text>

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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={THEME.colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Register</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Already have an account? <Text style={{color: THEME.colors.primary, fontWeight: '700'}}>Login</Text></Text>
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
  inputGroup: { marginBottom: 15 },
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
