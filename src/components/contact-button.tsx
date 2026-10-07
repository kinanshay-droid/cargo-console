import { MessageCircle, Mail, Phone, HelpCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Single source of truth for AFIK's support contact details — used to build
// the WhatsApp/email/phone links below. Update here if the contact changes.
const SUPPORT_PHONE_DISPLAY = "054-319-9988";
const SUPPORT_PHONE_E164 = "+972543199988"; // local 054-319-9988 in international format, for tel:/wa.me
const SUPPORT_EMAIL = "kinanshay@gmail.com";

export function ContactButton({ className }: { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={className}>
          <HelpCircle className="h-4 w-4" />
          יצירת קשר
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/${SUPPORT_PHONE_E164.replace("+", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4 text-success" />
            <span className="flex-1">WhatsApp</span>
            <span dir="ltr" className="text-xs text-muted-foreground">
              {SUPPORT_PHONE_DISPLAY}
            </span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" />
            <span className="flex-1">שליחת מייל</span>
            <span dir="ltr" className="text-xs text-muted-foreground">
              {SUPPORT_EMAIL}
            </span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`tel:${SUPPORT_PHONE_E164}`} className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <span className="flex-1">שיחת טלפון</span>
            <span dir="ltr" className="text-xs text-muted-foreground">
              {SUPPORT_PHONE_DISPLAY}
            </span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
