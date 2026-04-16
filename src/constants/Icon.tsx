import React from 'react';
import Fontisto from '@expo/vector-icons/Fontisto';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {COLORS} from '@/src/constants/colors'

export type IconName =
  | 'image'
  | 'voice'
  | 'file'
  | 'video'
  | 'url'
  | 'note'
  | 'task'
  | 'meeting'
  | 'save';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export const Icon = ({
  name,
  size = 24,
  color = COLORS.text,
}: IconProps): React.ReactElement | null => { 
  switch (name) {
    case 'note':
      return <FontAwesome name="sticky-note" size={size} color={color} />
    case 'task':
      return <MaterialIcons name="task-alt" size={size} color={color} />
    case 'meeting':
      return <FontAwesome name="calendar" size={size} color={color} />
    case 'image':
      return <Fontisto name="picture" size={size} color={color} />;
    case 'file':
      return <Fontisto name="file-1" size={size} color={color} />;
    case 'video':
      return <MaterialIcons name="video-file" size={size} color={color} />;
    case 'voice':
      return <Fontisto name="mic" size={size} color={color} />;
    case 'url':
      return <Fontisto name="link" size={size} color={color} />;
    case 'save':
      return <MaterialIcons name="save"size={size} color={color} />
    default:
      return null; 
  }
};