import type { Platform } from "../shared/types";
export interface PlatformDefinition {
  nextSelector: string;
  workSelector: string;
  educationSelector: string;
  labelContainer: string;
}
export const platformDefinitions: Record<Platform, PlatformDefinition> = {
  greenhouse: {
    nextSelector: "#application_form button,form button",
    workSelector: '.work-experience,[data-section="employment"],fieldset',
    educationSelector: '.education-entry,[data-section="education"],fieldset',
    labelContainer: ".field,.select__container",
  },
  smartrecruiters: {
    nextSelector:
      '[data-test="next-button"],.application-form button,form button',
    workSelector:
      '[data-test="experience"],[data-section="employment"],fieldset',
    educationSelector:
      '[data-test="education"],[data-section="education"],fieldset',
    labelContainer: ".form-group,.field",
  },
  workday: {
    nextSelector: '[data-automation-id="bottom-navigation-next-button"]',
    workSelector:
      '[data-automation-id^="workExperience-"],[data-section="employment"],fieldset',
    educationSelector:
      '[data-automation-id^="education-"],[data-section="education"],fieldset',
    labelContainer:
      '[data-automation-id="formField"],[data-automation-id^="formField-"]',
  },
  generic: {
    nextSelector: "",
    workSelector: '[data-section="employment"],fieldset',
    educationSelector: '[data-section="education"],fieldset',
    labelContainer: "",
  },
};
