import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
};

export default function ImageSourceSheet({ visible, title, onClose, onCamera, onLibrary }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Choose how to add the photo</Text>
          <TouchableOpacity style={styles.row} onPress={onCamera} activeOpacity={0.8}>
            <Ionicons name="camera" size={22} color={colors.black} />
            <Text style={styles.rowText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={onLibrary} activeOpacity={0.8}>
            <Ionicons name="images" size={22} color={colors.black} />
            <Text style={styles.rowText}>Choose from gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.black,
  },
  sub: {
    marginTop: 4,
    marginBottom: spacing.md,
    color: colors.gray,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowText: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.black,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: colors.gray,
    fontWeight: '700',
  },
});
