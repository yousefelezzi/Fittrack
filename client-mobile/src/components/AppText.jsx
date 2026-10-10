/**
 * Text and TextInput for the whole app: they follow the phone's text size
 * setting, but only up to MAX_FONT_SCALE, so rows, buttons and boxes keep
 * their shape at the largest accessibility sizes. (React 19 dropped
 * defaultProps on function components, so this is how the cap is applied.)
 */
import React, { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

export const MAX_FONT_SCALE = 1.3;

export const Text = forwardRef((props, ref) => <RNText ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />);
Text.displayName = 'Text';

export const TextInput = forwardRef((props, ref) => <RNTextInput ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />);
TextInput.displayName = 'TextInput';
