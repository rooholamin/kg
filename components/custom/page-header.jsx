import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';
import { cn } from '@/lib/utils';

/**
 * Reusable page chrome: toolbar title, optional description, breadcrumbs, actions.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  className,
}) {
  const last = breadcrumbs.length - 1;
  return (
    <Container className={cn(className)}>
      <Toolbar>
        <ToolbarHeading>
          <ToolbarTitle>{title}</ToolbarTitle>
          {description && (
            <p className="text-sm text-muted-foreground pt-0.5 max-w-2xl">
              {description}
            </p>
          )}
          {breadcrumbs.length > 0 && (
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.flatMap((crumb, i) => {
                  const key = `bc-${i}-${crumb.label}`;
                  const isLast = i === last;
                  const item = (
                    <BreadcrumbItem key={key}>
                      {!isLast && crumb.href ? (
                        <BreadcrumbLink href={crumb.href}>
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  );
                  if (i === 0) return [item];
                  return [
                    <BreadcrumbSeparator key={`${key}-sep`} />,
                    item,
                  ];
                })}
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </ToolbarHeading>
        {actions && <ToolbarActions>{actions}</ToolbarActions>}
      </Toolbar>
    </Container>
  );
}
