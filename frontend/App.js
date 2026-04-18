import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';

import HubDashboardScreen from './src/screens/HubDashboardScreen';
import PracticeDashboardScreen from './src/screens/PracticeDashboardScreen';
import VocabHubScreen from './src/screens/VocabHubScreen';
import ParrotScreen from './src/screens/ParrotScreen';
import WritingScreen from './src/screens/WritingScreen';
import StudyHubScreen from './src/screens/StudyHubScreen';
import SpeakingScreen from './src/screens/SpeakingScreen';
import JournalScreen from './src/screens/JournalScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { THEME } from './src/theme';
import { auth } from './src/api';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: THEME.colors.background,
    card: THEME.colors.surface,
    text: THEME.colors.onBackground,
    border: THEME.colors.border,
    primary: THEME.colors.primary,
  },
};

// ── Shared Header Options ───────────────────────────────────────────────
const screenOptions = (onLogout) => ({
  headerStyle: { backgroundColor: THEME.colors.surface, borderBottomWidth: 0, elevation: 0, shadowOpacity: 0 },
  headerTintColor: THEME.colors.primary,
  headerTitleStyle: { fontWeight: '800', fontSize: 18 },
  headerRight: () => (
    <TouchableOpacity onPress={onLogout} style={{ marginRight: 20 }}>
      <Text style={{ color: THEME.colors.primary, fontWeight: '700' }}>Logout</Text>
    </TouchableOpacity>
  ),
});

// ── Nested Stacks ────────────────────────────────────────────────────────

function HubStack({ onLogout }) {
  return (
    <Stack.Navigator screenOptions={screenOptions(onLogout)}>
      <Stack.Screen name="HubHome" component={HubDashboardScreen} options={{ title: 'Discovery' }} />
      <Stack.Screen name="VocabDetail" component={VocabHubScreen} options={{ title: 'Vocab' }} />
      <Stack.Screen name="ParrotDetail" component={ParrotScreen} options={{ title: 'Parrot' }} />
    </Stack.Navigator>
  );
}

function PracticeStack({ onLogout }) {
  return (
    <Stack.Navigator screenOptions={screenOptions(onLogout)}>
      <Stack.Screen name="PracticeHome" component={PracticeDashboardScreen} options={{ title: 'Practice Center' }} />
      <Stack.Screen name="StudyHub" component={StudyHubScreen} options={{ title: 'Study Hub' }} />
      <Stack.Screen name="WritingDetail" component={WritingScreen} options={{ title: 'Writing Practice' }} />
      <Stack.Screen name="SpeakingDetail" component={SpeakingScreen} options={{ title: 'Speaking Practice' }} />
      <Stack.Screen name="JournalDetail" component={JournalScreen} options={{ title: 'Daily Reflection' }} />
    </Stack.Navigator>
  );
}

function AppTabs({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: THEME.colors.surface, 
          borderTopWidth: 1, 
          borderTopColor: THEME.colors.border,
          height: 70, 
          paddingBottom: 12,
          paddingTop: 8,
          ...THEME.shadows.medium 
        },
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 12 },
      }}
    >
      <Tab.Screen 
        name="Discover" 
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🌐</Text> }}
      >
        {(props) => <HubStack {...props} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen 
        name="Practice" 
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🎯</Text> }}
      >
        {(props) => <PracticeStack {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    const token = await auth.getToken();
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 1. Wake up the backend (Render free tier) immediately
    auth.prewarm();
    // 2. Check login status
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={{ 
          marginTop: 20, 
          color: THEME.colors.textMuted, 
          fontWeight: '600',
          fontSize: 14 
        }}>
          Initialising IELTS Daily...
        </Text>
        <Text style={{ 
          marginTop: 8, 
          color: THEME.colors.textMuted, 
          fontSize: 12,
          fontStyle: 'italic'
        }}>
          (Waking up server if idle)
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <NavigationContainer theme={CustomLightTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthenticated ? (
              <>
                <Stack.Screen name="Login">
                  {(props) => <LoginScreen {...props} onLogin={() => setIsAuthenticated(true)} />}
                </Stack.Screen>
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            ) : (
              <Stack.Screen name="MainTabs">
                {(props) => <AppTabs {...props} onLogout={() => {
                  auth.logout();
                  setIsAuthenticated(false);
                }} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </View>
  );
}
