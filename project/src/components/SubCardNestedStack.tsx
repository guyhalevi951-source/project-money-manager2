import type { HTMLAttributes, ReactNode } from 'react';
import {
  MAIN_CARD_CANVAS_ATTR,
  MASTER_CATEGORY_PANEL_ATTR,
  NESTED_LIST_CAPSULE_ATTR,
  NESTED_LIST_CAPSULES_ON_MAIN_ATTR,
  NESTED_LIST_ITEM_ATTR,
  NESTED_LIST_STACK_ATTR,
  subCardMasterCategoryBodyClass,
  subCardMasterCategoryCollapsedClass,
  subCardMasterCategoryExpandedClass,
  subCardMasterCategoryStackClass,
  subCardNestedAccordionTriggerClass,
  subCardNestedCapsuleClass,
  subCardNestedCapsuleOnMainStackClass,
  subCardNestedCapsuleStackClass,
  subCardNestedExpandedClass,
  subCardNestedItemClass,
  subCardNestedListStackClass,
  subCardNestedSectionCapsuleClass,
} from '../styles/themeSurfaceStyles';

interface SubCardNestedStackProps {
  className?: string;
  children: ReactNode;
  /**
   * `capsule` — Cat 7 cards on implicit parent canvas (nested inside a sub-card body).
   * `capsuleOnMain` — Cat 7 cards on Cat 6 backing sheet (expanded master accordion).
   * `list` — flush rows with divider/zebra (history tables).
   */
  variant?: 'capsule' | 'capsuleOnMain' | 'list';
}

interface SubCardNestedItemProps {
  className?: string;
  children: ReactNode;
  variant?: 'capsule' | 'list';
}

/**
 * CRITICAL LAYOUT RULE: All nested parameters and option sub-rows inside configuration
 * contexts must render as fully encapsulated standalone capsules separated by a minimal
 * grid gap of 16px (`gap-4`) to prevent vertical item compression.
 */
export function SubCardNestedStack({ className, children, variant = 'capsule' }: SubCardNestedStackProps) {
  const stackClass =
    variant === 'list'
      ? subCardNestedListStackClass
      : variant === 'capsuleOnMain'
        ? subCardNestedCapsuleOnMainStackClass
        : subCardNestedCapsuleStackClass;

  const isCapsule = variant === 'capsule' || variant === 'capsuleOnMain';

  return (
    <div
      className={[stackClass, className].filter(Boolean).join(' ')}
      {...{
        [NESTED_LIST_STACK_ATTR]: '',
        ...(isCapsule ? { [NESTED_LIST_CAPSULE_ATTR]: '' } : {}),
        ...(variant === 'capsuleOnMain' ? { [NESTED_LIST_CAPSULES_ON_MAIN_ATTR]: '' } : {}),
      }}
    >
      {children}
    </div>
  );
}

/**
 * Rounded outer perimeter wrapper for one sub-category block (header + expanded body).
 * Example: מטבע תצוגה — trigger and DisplayCurrencySelector live inside this frame.
 */
export function SubCategorySectionCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <article
      className={[subCardNestedSectionCapsuleClass, className].filter(Boolean).join(' ')}
      data-sub-category-section
      {...{ [NESTED_LIST_ITEM_ATTR]: '' }}
    >
      {children}
    </article>
  );
}

/** Expanded dynamic content region inside a SubCategorySectionCard (החלק התת). */
export function SubCategorySectionBody({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={[subCardNestedExpandedClass, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

type MasterCategoryPanelProps = HTMLAttributes<HTMLElement> & {
  expanded: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Outermost settings/profile category accordion (מטבעות, הגדרות כלליות, theme master).
 * When expanded, header and all nested sub-category capsules share one rounded master frame.
 */
export function MasterCategoryPanel({ expanded, className, children, ...rest }: MasterCategoryPanelProps) {
  const shellClass = expanded ? subCardMasterCategoryExpandedClass : subCardMasterCategoryCollapsedClass;

  return (
    <article
      className={[shellClass, className].filter(Boolean).join(' ')}
      {...{ [MASTER_CATEGORY_PANEL_ATTR]: '' }}
      data-master-category-expanded={expanded || undefined}
      {...rest}
    >
      {children}
    </article>
  );
}

/** Expanded children region inside a MasterCategoryPanel (sub-capsule stack, footers). */
export function MasterCategoryPanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={[subCardMasterCategoryBodyClass, className].filter(Boolean).join(' ')}
      {...{ [MAIN_CARD_CANVAS_ATTR]: '' }}
    >
      {children}
    </div>
  );
}

/** Single row — capsule (settings/profile) or flat list item (history). */
export function SubCardNestedItem({ className, children, variant = 'capsule' }: SubCardNestedItemProps) {
  if (variant === 'capsule') {
    return <SubCategorySectionCard className={className}>{children}</SubCategorySectionCard>;
  }

  return (
    <div className={[subCardNestedItemClass, className].filter(Boolean).join(' ')} {...{ [NESTED_LIST_ITEM_ATTR]: '' }}>
      {children}
    </div>
  );
}

export {
  subCardNestedAccordionTriggerClass,
  subCardNestedExpandedClass,
  subCardNestedCapsuleClass,
  subCardNestedSectionCapsuleClass,
  subCardMasterCategoryStackClass,
};
