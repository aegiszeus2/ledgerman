import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

interface DashboardScreenProps {
  worker: any;
  onLogout: () => void;
  onNavigate: (screen: string) => void;
}

export default function DashboardScreen({
  worker,
  onLogout,
  onNavigate,
}: DashboardScreenProps) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, {worker?.name}</Text>
        <Text style={styles.company}>{worker?.company}</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('TimeEntry')}
        >
          <Text style={styles.menuTitle}>Log Time</Text>
          <Text style={styles.menuDesc}>Record work hours</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('Tasks')}
        >
          <Text style={styles.menuTitle}>All Tasks</Text>
          <Text style={styles.menuDesc}>View all tasks across projects</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('Projects')}
        >
          <Text style={styles.menuTitle}>Projects</Text>
          <Text style={styles.menuDesc}>View projects & their tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('Photos')}
        >
          <Text style={styles.menuTitle}>Upload Photos</Text>
          <Text style={styles.menuDesc}>Add project photos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('PhotoGallery')}
        >
          <Text style={styles.menuTitle}>Photo Gallery</Text>
          <Text style={styles.menuDesc}>View all uploaded photos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('Settings')}
        >
          <Text style={styles.menuTitle}>Settings</Text>
          <Text style={styles.menuDesc}>Manage your profile</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 40,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  company: {
    fontSize: 16,
    color: '#e0e0e0',
    marginTop: 4,
  },
  menu: {
    padding: 16,
    gap: 12,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  menuDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
