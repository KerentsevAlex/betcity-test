import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {catchError, map, retry} from "rxjs/operators";
import {Observable, throwError} from "rxjs";
import {ListItemInterface} from "./components/list/list.component";

@Injectable({
	providedIn: 'root'
})
export class ListService {
	private readonly _headers: HttpHeaders = new HttpHeaders({
		'Content-Type': 'application/json'
	});

	constructor(private _http: HttpClient) {
	}

	public getList(limit: string, nextPageToken?: string): Observable<ListInterface> {
		let request = {
			key: 'AIzaSyD-UYCzGCchmRTi9Y3zTuWyu6i0XOyTpjI',
			part: 'snippet',
			order: 'date',
			maxResults: limit,
			playlistId: 'PLidy2DocKWBOtRqkFSRcI4wdrt4wxWPm0'
		};

		if (nextPageToken) {
			request['pageToken'] = nextPageToken;
		}
		return this._http.get<ListInterface>('https://www.googleapis.com/youtube/v3/playlistItems', {
			headers: this._headers,
			params: request
		})
			.pipe(
				map(response => {
					return <ListInterface>{
						items: response.items,
						nextPageToken: response.nextPageToken,
						pageInfo: {
							resultsPerPage: response.pageInfo.resultsPerPage,
							totalResults: response.pageInfo.totalResults
						},
						isLoading: false
					}
				}),
				retry(1),
				catchError(errorHandl)
			)
	}
}

function errorHandl(error) {
	let errorMessage = '';
	if (error.error instanceof ErrorEvent) {
		// Get client-side error
		errorMessage = error.error.message;
	} else {
		// Get server-side error
		errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
	}
	console.log(errorMessage);
	return throwError(errorMessage);
}

export interface ListInterface {
	items: any;
	nextPageToken: string;
	pageInfo: {
		resultsPerPage: number,
		totalResults: number
	};
	isLoading: boolean;
}
