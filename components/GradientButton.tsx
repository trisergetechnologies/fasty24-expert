import { ReactNode } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows, gradients } from '../constants/theme';

type Variant = 'primary' | 'dark' | 'success';

const VARIANT_GRADIENTS: Record<Variant, readonly [string, string]> = {
  primary: gradients.primary,
  dark: gradients.dark,
  success: gradients.success,
};

const VARIANT_TEXT_COLOR: Record<Variant, string> = {
  primary: colors.black,
  dark: colors.yellow,
  success: colors.white,
};

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function GradientButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
  style,
  textStyle,
}: Props) {
  const isDisabled = disabled || loading;
  const textColor = VARIANT_TEXT_COLOR[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={VARIANT_GRADIENTS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, shadows.float]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, { color: textColor }, icon ? styles.textWithIcon : null, textStyle]}>
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    fontSize: 16,
  },
  textWithIcon: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});
