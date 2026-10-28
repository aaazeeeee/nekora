import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

type SelectProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  id?: string;
  'aria-label'?: string;
  variant?: 'field' | 'ghost';
  icon?: LucideIcon;
  disabled?: boolean;
};

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  id,
  'aria-label': ariaLabel,
  variant = 'field',
  icon: TriggerIcon,
  disabled,
}: SelectProps<T>) {
  return (
    <SelectPrimitive.Root
      value={value}
      // Radix types the value as string; only values from `options` can be chosen.
      onValueChange={(next) => onValueChange(next as T)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn('select-trigger', variant === 'ghost' && 'ghost')}
      >
        {TriggerIcon && <TriggerIcon size={15} aria-hidden="true" />}
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="select-chevron">
          <ChevronDown size={15} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-content"
          position="popper"
          sideOffset={6}
          align="start"
        >
          <SelectPrimitive.Viewport>
            {options.map(
              ({ value: optionValue, label, description, icon: Icon }) => (
                <SelectPrimitive.Item
                  key={optionValue}
                  value={optionValue}
                  className="select-item"
                >
                  {Icon && (
                    <span className="select-item-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                  )}
                  <span className="select-item-text">
                    <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
                    {description && <small>{description}</small>}
                  </span>
                  <SelectPrimitive.ItemIndicator className="select-check">
                    <Check size={15} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ),
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
