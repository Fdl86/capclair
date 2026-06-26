import { useState, type ReactNode } from 'react';

interface AccordionProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function Accordion({ title, subtitle, action, defaultOpen = true, className = '', children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`accordion ${open ? 'is-open' : 'is-closed'} ${className}`}>
      <div className="accordion-head">
        <button
          type="button"
          className="accordion-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <span className="accordion-chevron" aria-hidden="true" />
          <span className="accordion-titles">
            <span className="accordion-title">{title}</span>
            {subtitle != null && <strong className="accordion-subtitle">{subtitle}</strong>}
          </span>
        </button>
        {action && <div className="accordion-action">{action}</div>}
      </div>
      {open && <div className="accordion-body">{children}</div>}
    </section>
  );
}
