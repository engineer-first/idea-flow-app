import { redirect } from "next/navigation";

type QueryError = {
  message: string;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

export function unwrapRoomQueryResult<T>(
  result: QueryResult<T>,
  inviteCode: string,
) {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    redirect(`/invite/${encodeURIComponent(inviteCode)}`);
  }

  return result.data;
}
