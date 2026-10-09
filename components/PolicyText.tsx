import { Fragment } from 'react'
import { POLICY_CONFIG } from '@/lib/privacy-policy'

// Renders one policy string: fills {placeholders} from POLICY_CONFIG and turns
// every [CONFIRM: ...] into a highlighted marker so it cannot ship unnoticed.
// The highlight uses a visible label and colour, not colour alone.

type ConfigKey = 'companyName' | 'contactEmail' | 'mailingAddress'

function fill(text: string): string {
  return text.replace(/\{(companyName|contactEmail|mailingAddress)\}/g, (_, key: ConfigKey) => POLICY_CONFIG[key])
}

export function PolicyText({ text }: { text: string }) {
  const parts = fill(text).split(/(\[CONFIRM:[^\]]*\])/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('[CONFIRM:') ? (
          <mark
            key={i}
            className="rounded bg-warn/25 px-1 font-medium text-warn"
            data-confirm="true"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}
